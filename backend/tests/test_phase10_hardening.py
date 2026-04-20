"""Phase 10 hardening tests.

Covers the optimization + product refinement pass:

- the conftest swap from bcrypt to a fast CryptContext is in place and
  actually applies to seed / login, so per-test setup no longer burns
  CPU on password hashing
- typography wiring: the frontend loads Inter + JetBrains Mono via
  `next/font/google` and exposes them as CSS variables; Tailwind
  consumes those variables; `tabular-nums` is active on body copy
- motion wiring: Tailwind keyframes exist and core surfaces (modals,
  confirm dialog, main area, login landing) reference them
- product polish markers: identifiers render via the new `mono` utility
  or the tabular-nums base rule so numeric columns align
- Playwright suite grew the confirm-dialog and typography/motion specs
"""

from __future__ import annotations

import re
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND = REPO_ROOT / "backend"
FRONTEND = REPO_ROOT / "frontend"


# --------------------------------------------------------------------------
# Phase 10A — backend test runtime
# --------------------------------------------------------------------------


def test_conftest_swaps_crypt_context_for_fast_scheme():
    text = (BACKEND / "tests" / "conftest.py").read_text(encoding="utf-8")
    assert "pwd_context" in text
    assert "plaintext" in text
    # The swap must happen before any application module that depends on
    # password hashing gets imported (seed_data, main, etc.).
    swap = text.index('pwd_context = CryptContext(schemes=["plaintext"])')
    seed_import = text.index("from app.seed.seed_data import seed")
    assert swap < seed_import


def test_conftest_session_binds_app_to_test_engine():
    text = (BACKEND / "tests" / "conftest.py").read_text(encoding="utf-8")
    # Binding the app's db_module + dependency_overrides at session scope
    # cuts per-test monkeypatch churn that previously ran every test.
    assert "_bind_app_to_test_engine" in text
    assert 'scope="session"' in text


def test_fast_password_hashing_is_effectively_free():
    # The session-wide CryptContext swap happens inside conftest.py, so
    # importing `app.core.security` in this test process *also* sees the
    # patched context (pytest loaded conftest before importing this file).
    import time

    from app.core.security import hash_password, verify_password

    t = time.perf_counter()
    hashed = hash_password("fast-path")
    assert verify_password("fast-path", hashed)
    elapsed_ms = (time.perf_counter() - t) * 1000
    # bcrypt would be ~600 ms for hash + verify; plaintext is sub-ms.
    # Ceiling is generous to tolerate slow CI runners.
    assert elapsed_ms < 50, f"password hashing is unexpectedly slow ({elapsed_ms:.1f} ms)"


# --------------------------------------------------------------------------
# Phase 10B — typography
# --------------------------------------------------------------------------


def test_next_font_wires_inter_and_jetbrains_mono():
    text = (FRONTEND / "app" / "layout.tsx").read_text(encoding="utf-8")
    assert 'from "next/font/google"' in text
    assert "Inter(" in text
    assert "JetBrains_Mono(" in text
    # The fonts must be exposed as CSS variables so Tailwind can reference
    # them — otherwise the font families do not actually apply.
    assert '"--font-sans"' in text
    assert '"--font-mono"' in text
    # Next's classNames get attached to <html>.
    assert "inter.variable" in text and "jetbrainsMono.variable" in text


def test_tailwind_consumes_font_variables():
    text = (FRONTEND / "tailwind.config.ts").read_text(encoding="utf-8")
    assert '"var(--font-sans)"' in text
    assert '"var(--font-mono)"' in text


def test_globals_css_applies_tabular_nums_globally_and_exposes_mono_utility():
    text = (FRONTEND / "app" / "globals.css").read_text(encoding="utf-8")
    # Body-wide tabular numerals align numbers in tables and metrics.
    body_rule = re.search(
        r"body\s*\{[^}]*font-variant-numeric:\s*tabular-nums",
        text,
        re.DOTALL,
    )
    assert body_rule is not None, "body rule must set tabular-nums"
    # `.mono` utility for identifiers (hashes, audit IDs, rule codes).
    assert ".mono" in text
    # Reduced-motion preference must be respected so the animation layer
    # doesn't harm accessibility.
    assert "prefers-reduced-motion" in text


# --------------------------------------------------------------------------
# Phase 10C — motion
# --------------------------------------------------------------------------


def test_tailwind_registers_chain_pulse_keyframe():
    # The UI elevation pass replaced the one-shot CSS keyframes
    # (fade-in / fade-in-slow / overlay-in / dialog-in / page-in) with
    # Framer Motion primitives. Only the chain-pulse ambient heartbeat
    # remains in tailwind.config.ts — used by live indicators (blocked
    # status dot, dashboard LIVE pill) where CSS is the right primitive
    # for a perpetual, JS-free loop.
    text = (FRONTEND / "tailwind.config.ts").read_text(encoding="utf-8")
    assert '"chain-pulse"' in text, "chain-pulse keyframe/animation missing"
    for removed in ("fade-in", "fade-in-slow", "overlay-in", "dialog-in", "page-in"):
        assert f'"{removed}"' not in text, (
            f"legacy keyframe {removed!r} should have been removed"
        )


def test_modal_and_dialog_use_motion_utilities():
    # The UI elevation pass swapped the one-shot CSS keyframes out for
    # Framer Motion primitives (overlayFade + dialogPop from the motion
    # vocabulary module), gated by AnimatePresence and useReducedMotion.
    # Both the preview overlay and the confirm dialog must wire through
    # the shared vocabulary so reduced-motion handling stays uniform.
    preview = (
        FRONTEND
        / "components"
        / "record-detail"
        / "PreviewOverlay.tsx"
    ).read_text(encoding="utf-8")
    assert "AnimatePresence" in preview
    assert "overlayFade" in preview
    assert "dialogPop" in preview

    confirm = (FRONTEND / "components" / "ConfirmDialog.tsx").read_text(
        encoding="utf-8"
    )
    assert "AnimatePresence" in confirm
    assert "overlayFade" in confirm
    assert "dialogPop" in confirm


def test_app_shell_and_panel_and_login_carry_controlled_motion():
    shell = (FRONTEND / "components" / "AppShell.tsx").read_text(encoding="utf-8")
    assert "animate-fade-in" in shell
    # `key={pathname}` re-mounts <main> on route changes, so the fade-in
    # actually replays. Without this the class would only animate once.
    assert "key={pathname}" in shell

    panel = (FRONTEND / "components" / "Panel.tsx").read_text(encoding="utf-8")
    assert "animate-fade-in" in panel

    # The old 1600ms animate-page-in CSS fade on /login was retired in
    # favour of a short Framer Motion entrance (fadeRise + SPRING_DEFAULT
    # + useReducedMotion). The contract now pins the new vocabulary.
    login = (FRONTEND / "app" / "login" / "page.tsx").read_text(encoding="utf-8")
    assert "animate-page-in" not in login
    assert "fadeRise" in login
    assert "useReducedMotion" in login


# --------------------------------------------------------------------------
# Phase 10D — product polish
# --------------------------------------------------------------------------


def test_record_header_uses_mono_utility_for_identifiers():
    text = (
        FRONTEND / "components" / "record-detail" / "RecordHeader.tsx"
    ).read_text(encoding="utf-8")
    assert 'className="mono text-text"' in text
    assert 'className="mono text-sm"' in text


def test_records_table_renders_external_reference_in_mono():
    text = (FRONTEND / "app" / "(app)" / "records" / "page.tsx").read_text(
        encoding="utf-8"
    )
    assert "mono mt-0.5" in text or 'className="mono' in text


def test_document_rows_render_integrity_hash_in_mono():
    text = (
        FRONTEND / "components" / "record-detail" / "DocumentRows.tsx"
    ).read_text(encoding="utf-8")
    assert '<span className="mono">' in text


# --------------------------------------------------------------------------
# Phase 10E — Playwright follow-through
# --------------------------------------------------------------------------


def test_playwright_has_confirm_dialog_and_motion_specs():
    e2e = FRONTEND / "tests" / "e2e"
    assert (e2e / "confirm-dialog.spec.ts").is_file()
    assert (e2e / "typography-motion.spec.ts").is_file()

    confirm = (e2e / "confirm-dialog.spec.ts").read_text(encoding="utf-8")
    assert "alertdialog" in confirm
    assert "Escape" in confirm

    motion = (e2e / "typography-motion.spec.ts").read_text(encoding="utf-8")
    assert "animate-page-in" in motion
    assert "animate-fade-in" in motion
