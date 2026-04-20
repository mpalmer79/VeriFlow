"""Tiny in-process sliding-window rate limiter.

No external dependencies. Keyed by `(bucket_name, client_key)` so
different routes can apply different budgets without sharing counters.
For a multi-process deployment, swap this out for a Redis-backed
implementation; the `rate_limit` dependency below is the only API that
needs to change.
"""

from __future__ import annotations

import time
from collections import defaultdict, deque
from threading import Lock
from typing import Callable, Deque, Dict, Optional, Tuple

from fastapi import Depends, HTTPException, Request, status

from app.api.deps import get_current_user
from app.models.user import User


_Bucket = Deque[float]


class RateLimiter:
    def __init__(self) -> None:
        self._buckets: Dict[Tuple[str, str], _Bucket] = defaultdict(deque)
        self._lock = Lock()

    def allow(
        self,
        *,
        bucket: str,
        key: str,
        max_requests: int,
        window_seconds: float,
    ) -> bool:
        if max_requests <= 0:
            return True
        now = time.monotonic()
        cutoff = now - window_seconds
        with self._lock:
            q = self._buckets[(bucket, key)]
            while q and q[0] < cutoff:
                q.popleft()
            if len(q) >= max_requests:
                return False
            q.append(now)
            return True

    def clear(self) -> None:
        with self._lock:
            self._buckets.clear()


_limiter = RateLimiter()


def _client_key(request: Request, user: Optional[User]) -> str:
    if user is not None:
        return f"user:{user.id}"
    # Fall back to the remote host; X-Forwarded-For is not trusted here.
    host = request.client.host if request.client else "unknown"
    return f"ip:{host}"


def rate_limit(
    bucket: str,
    *,
    max_requests: int | Callable[[], int],
    window_seconds: float = 60.0,
    authenticated: bool = False,
) -> Callable:
    """Return a FastAPI dependency that enforces a rate limit.

    `max_requests` can be an int or a zero-arg callable evaluated
    per-request; passing a callable lets the limit track `Settings`
    changes (and makes the limit swappable in tests without relying on
    module-import timing).

    `authenticated=True` keys the bucket by the acting user's id and
    injects `get_current_user`, so a signed-in caller's budget is not
    shared with anonymous traffic from the same IP.
    """

    def _resolve_limit() -> int:
        return max_requests() if callable(max_requests) else max_requests

    if authenticated:
        def checker_authed(
            request: Request, user: User = Depends(get_current_user)
        ) -> User:
            key = _client_key(request, user)
            if not _limiter.allow(
                bucket=bucket,
                key=key,
                max_requests=_resolve_limit(),
                window_seconds=window_seconds,
            ):
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many requests; please slow down.",
                )
            return user

        return checker_authed

    def checker_anon(request: Request) -> None:
        key = _client_key(request, None)
        if not _limiter.allow(
            bucket=bucket,
            key=key,
            max_requests=_resolve_limit(),
            window_seconds=window_seconds,
        ):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests; please slow down.",
            )

    return checker_anon


def reset_rate_limits() -> None:
    """Test helper. Clears all in-memory buckets."""
    _limiter.clear()
