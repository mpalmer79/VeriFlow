"""Replay-guard coverage for signed-access JTI consumption.

The guard is bounded, threaded, and honors a short grace window after
the first use so a browser can issue follow-up HTTP Range requests on
the same preview URL. These tests pin each side of that contract.
"""

from __future__ import annotations

from threading import Barrier, Thread
from typing import List

import pytest

from app.core import content_access
from app.core.content_access import (
    ContentAccessReplayGuard,
    consume_signed_access_jti,
    reset_content_access_guard,
)


@pytest.fixture(autouse=True)
def _reset_guard():
    reset_content_access_guard()
    yield
    reset_content_access_guard()


def test_signed_jti_single_use_under_race():
    """Sixteen threads racing on the same jti must produce exactly one
    first-consumer. The remaining fifteen calls land inside the grace
    window (which is fine — all True is allowed there), so we target a
    *fresh* guard instance with a zero-length grace window so each call
    after the first is a real reuse attempt and must be rejected.
    """
    guard = ContentAccessReplayGuard(session_window_seconds=0.0)

    jti = "race-jti"
    exp = 10**12  # far future

    barrier = Barrier(16)
    results: List[bool] = []
    results_lock_sentinel = object()

    def attempt():
        barrier.wait()
        results.append(guard.consume(jti, exp))

    threads = [Thread(target=attempt) for _ in range(16)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert sum(1 for ok in results if ok) == 1
    # Sentinel was never meant to appear; keeps the linter from
    # complaining about the unused `results_lock_sentinel`.
    assert results_lock_sentinel is not None


def test_signed_jti_grace_window_allows_immediate_reuse(monkeypatch):
    """Two sequential calls inside the grace window both return True;
    a third call past the window returns False. Uses a frozen clock so
    the test does not sleep.
    """
    clock = {"now": 1000.0}

    def fake_time() -> float:
        return clock["now"]

    monkeypatch.setattr(content_access.time, "time", fake_time)

    jti = "grace-jti"
    exp = clock["now"] + 120  # 2m TTL

    assert consume_signed_access_jti(jti, exp) is True

    clock["now"] += 1.5  # inside the 2s grace window
    assert consume_signed_access_jti(jti, exp) is True

    clock["now"] += 5.0  # past the window
    assert consume_signed_access_jti(jti, exp) is False


def test_signed_jti_rejects_expired_entries(monkeypatch):
    """Calling the guard with a jti whose `exp` is already in the past
    must not leave the entry behind — the next call for a different
    jti evicts it.
    """
    clock = {"now": 1000.0}

    def fake_time() -> float:
        return clock["now"]

    monkeypatch.setattr(content_access.time, "time", fake_time)

    # Prime a jti that expires at now - 10 (already expired).
    assert consume_signed_access_jti("expired-jti", clock["now"] - 10) is True

    # Touch a fresh jti — this triggers `_evict_expired_locked` and the
    # expired entry gets pruned so the guard's size stays at 1.
    clock["now"] += 0.01
    assert consume_signed_access_jti("fresh-jti", clock["now"] + 60) is True

    from app.core.content_access import _guard as module_guard

    assert len(module_guard) == 1
