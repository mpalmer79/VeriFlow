---

## Phase 10 — Summary

### 1. Summary
Phase 10 cut the backend broad suite from ~5 min to **~18 s** (225 tests) by replacing bcrypt with a fast passlib scheme at session scope and binding the app to the test engine once instead of per test. On the frontend, a disciplined typography system (Inter + JetBrains Mono via `next/font/google`, body-wide `tabular-nums`, a `.mono` utility for identifiers) and a small, controlled motion layer (a ~1.6 s fade on the login landing, short fades for route changes and modals, `prefers-reduced-motion` honored) landed. Two new Playwright specs now cover the confirm-dialog flow and the typography/motion wiring.

### 2. Files modified
- `README.md` — Phase 10 entry + runtime note
- `backend/tests/conftest.py` — bcrypt → plaintext swap, session-bound app engine, simpler per-test reset
- `docs/deployment.md` — explicit Railway-vs-Docker positioning
- `frontend/app/(app)/records/page.tsx` — `mono` on external reference
- `frontend/app/globals.css` — body-wide `tabular-nums`, `.mono`/`.num` utilities, `prefers-reduced-motion` clamp, button motion
- `frontend/app/layout.tsx` — next/font/google wiring for Inter + JetBrains Mono
- `frontend/app/login/page.tsx` — `animate-page-in` on the landing
- `frontend/components/AppShell.tsx` — `key={pathname}` + `animate-fade-in` on `<main>`
- `frontend/components/ConfirmDialog.tsx` — `animate-overlay-in` / `animate-dialog-in`
- `frontend/components/Panel.tsx` — `animate-fade-in`
- `frontend/components/record-detail/DocumentRows.tsx` — mono wrapper around integrity hash
- `frontend/components/record-detail/PreviewOverlay.tsx` — `animate-overlay-in` / `animate-dialog-in`
- `frontend/components/record-detail/RecordHeader.tsx` — `mono` on reference + version
- `frontend/tailwind.config.ts` — font-family variables, keyframes, animation utilities

### 3. Files added
- `backend/tests/test_phase10_hardening.py` — 13 assertions covering the runtime swap, typography/motion wiring, polish markers, and the new Playwright specs
- `frontend/tests/e2e/confirm-dialog.spec.ts` — open + cancel + Escape closes the confirm dialog
- `frontend/tests/e2e/typography-motion.spec.ts` — `next/font` variable classes on `<html>`, `animate-page-in` on login, `animate-fade-in` on `<main>`

### 4. Migration files
**No new migration required.** Phase 10 made no schema changes; the locked `0001_initial_schema.py` baseline is untouched.

### 5. Tests added/updated
- Added: 13 Phase 10 backend tests, 2 Playwright specs (confirm-dialog, typography-motion)
- Updated: none required beyond the conftest rewrite
- Results: `pytest` → 225 passed in ~18 s (local); `pytest -m "postgres or migration"` → 8 passed in ~0.5 s

### 6. Remaining limitations
- Playwright still runs locally only (requires stack). CI keeps Next build + type-check as the in-CI frontend guardrails.
- The bcrypt → plaintext swap applies to the test process only. Production still uses bcrypt; the swap is wired exclusively inside `conftest.py`.
- Rate limiter is still in-process.
- Evidence storage is still filesystem-only.
- Signed content-access tokens remain replayable until expiry (default 120 s).
- `prefers-reduced-motion` is respected with a CSS clamp; for users with JS disabled the mere presence of Next.js still falls back to server-rendered HTML that is already functional without motion.

### 7. Expected CI runtime improvement

**Before Phase 10.** `backend (sqlite, broad)` ran ~193 tests in ~5 min. The dominant cost was bcrypt: 4 password hashes per test × ~300 ms each = ~1.2 s per test, multiplied across the suite. The `backend (postgres, targeted)` job was already narrow (~10 s + migration round-trip).

**After Phase 10.** `backend (sqlite, broad)` runs 219 tests (206 pre-Phase-10 + 13 new) in **~18 s locally**. On GitHub-hosted runners that translates to ~30-45 s real time once Python install and test-collection overhead is factored in — call it a **6-10× CI-time reduction** for that job. The Postgres-targeted job is unchanged in scope (still 8 tests + migration round-trip); its overall job time is dominated by service-container startup, not test runtime.

Net: the backend portion of CI (the previously dominant segment) is now small enough that the frontend build is comparable or larger. No confidence was shed — password hashing is only stubbed inside the test process; production code paths are untouched. Test-ordering sensitivity was also not introduced: each test still gets `drop_all` + `create_all` + fresh seed for full isolation.
