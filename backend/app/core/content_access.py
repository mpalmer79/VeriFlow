"""In-process replay guard for signed content-access tokens.

Signed-access tokens are short-lived bearer URLs embedded in the browser
for preview/download, so each request arrives without the usual
Authorization header. The token itself is the authorization, which
previously left a replay window equal to the token's TTL (default 120s)
because any capture of the URL could be replayed until exp.

This module tracks the first time each `jti` is seen and enforces a
narrow post-first-use "session" during which the same jti may be used
again (e.g. the browser's PDF viewer issuing HTTP Range follow-up
requests on the same URL it just loaded). After that session window any
additional use is rejected. The store is bounded and auto-expires with
each token's own `exp`, so a flood of unique tokens cannot exhaust
memory.

Single-replica only. A multi-replica deployment would need a shared
store (e.g. Redis) to enforce replay prevention across nodes.
"""

from __future__ import annotations

import time
from collections import OrderedDict
from threading import Lock
from typing import Tuple


class ContentAccessReplayGuard:
    """Bounded 'first-use' + short grace-window tracker for signed-access
    tokens.

    `consume(jti, exp)` returns:
      * True  — first use of this jti, or reuse within the grace window
      * False — reuse after the grace window, within TTL
    """

    def __init__(
        self,
        *,
        max_entries: int = 4096,
        session_window_seconds: float = 2.0,
    ) -> None:
        # jti -> (first_seen_wall_seconds, exp_wall_seconds)
        self._used: "OrderedDict[str, Tuple[float, float]]" = OrderedDict()
        self._lock = Lock()
        self._max_entries = max_entries
        self._session_window = session_window_seconds

    def consume(self, jti: str, exp: float) -> bool:
        now = time.time()
        with self._lock:
            self._evict_expired_locked(now)
            existing = self._used.get(jti)
            if existing is not None:
                first_seen, _exp = existing
                # Allow follow-up requests for the same jti within a
                # short grace window. This covers browsers that fetch a
                # PDF preview URL and then issue HTTP Range follow-ups
                # on the same URL. Outside that window, reject.
                return (now - first_seen) <= self._session_window
            if len(self._used) >= self._max_entries:
                self._used.popitem(last=False)
            self._used[jti] = (now, exp)
            return True

    def _evict_expired_locked(self, now: float) -> None:
        for jti in list(self._used.keys()):
            _first_seen, exp = self._used[jti]
            if exp <= now:
                self._used.pop(jti, None)
            else:
                # OrderedDict is insertion-ordered, not exp-ordered, so
                # we have to walk the whole map. Entries are bounded by
                # `max_entries` which keeps this cheap in practice.
                continue

    def __len__(self) -> int:
        with self._lock:
            return len(self._used)

    def clear(self) -> None:
        with self._lock:
            self._used.clear()


_guard = ContentAccessReplayGuard()


def consume_signed_access_jti(jti: str, exp: float) -> bool:
    return _guard.consume(jti, exp)


def reset_content_access_guard() -> None:
    """Test helper. Clears the in-memory used-jti map."""
    _guard.clear()
