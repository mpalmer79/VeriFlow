# VeriFlow build history

This document preserves the original multi-phase build prompt
(Phases 1 through 8) that produced the current state of the
VeriFlow codebase. It is a historical artifact, not a guide
to steady-state work. For working conventions and invariants,
see CLAUDE.md at the repo root. For a user-facing summary of
what landed in each phase, see CHANGELOG.md.

---

# VeriFlow — Full Remediation + Frontend Polish

You are executing a multi-phase hardening and polish pass on the VeriFlow
codebase. Work one phase at a time. Do not start a phase until the
previous phase's tests pass. Commit at the end of each phase with the
message format specified in that phase.

## Global rules (apply to every phase)

- Strict layering is non-negotiable. Routes call services; services call
  repositories; repositories touch the ORM. No SQL in routes.
- Every new backend behavior gets a test. If you change a contract, you
  update the test that pins the contract.
- Every service exception type is caught in the route and translated to
  an HTTP status. No bare 500s.
- Backend tests: `cd backend && python -m pytest` must pass after every
  phase.
- Frontend: `cd frontend && npm run build` must succeed after every
  phase that touches the frontend.
- Do not introduce new dependencies unless the phase explicitly says so.
  If you think one is needed, stop and ask.
- Do not refactor unrelated files for style. No drive-by rewrites.
- Do not add comments that narrate what the code does. Comments explain
  *why* a non-obvious decision was made. If the code is obvious, no
  comment.
- Do not touch `CLAUDE.md`. Do not touch the baseline Alembic migration
  except in the phase that explicitly targets it.
- If a phase's instructions conflict with the existing
  `ARCHITECTURE.md`, update the doc — do not contradict it silently.
- When in doubt between "do the minimum the phase asks for" and "do
  more," do the minimum. Out-of-scope work belongs in a later phase.

## Pre-flight

Before Phase 1, run the test suite and confirm it passes. Print the
count. If it does not pass, stop and report.

Read these files first, in this order, so you have context:

- `ARCHITECTURE.md`
- `backend/app/services/record_service.py`
- `backend/app/services/workflow_service.py`
- `backend/app/services/evaluation_service.py`
- `backend/app/services/audit_service.py`
- `backend/app/services/rule_engine_service.py`
- `backend/app/core/security.py`
- `backend/app/core/content_access.py`
- `backend/app/api/routes/records.py`
- `backend/app/api/routes/documents.py`
- `frontend/lib/motion.ts`
- `frontend/app/globals.css`
- `frontend/tailwind.config.ts`

---

## Phase 1 — Backend integrity gaps

**Goal:** close the concrete integrity holes in the record update path
and fix the seed inconsistency. No frontend changes in this phase.

### 1A. Remove client-writable status from RecordUpdate

`RecordUpdate` currently exposes `status: Optional[RecordStatus]`. This
lets a client `PATCH` a record directly to `ready` or `closed` without
going through the transition flow, bypassing rule evaluation, audit
events, and risk recalculation.

Required change:

- Remove `status` from `RecordUpdate` in
  `backend/app/schemas/record.py`.
- Keep `status` writable from the service layer (transition, blocked
  detection, explicit admin actions). Do not change how
  `workflow_service.transition_record` sets status.
- The one case where `update_record` currently lets status be patched
  is *any* client update. After this change, `update_record` must not
  set `status` from the payload — remove that code path.

Add a test in `backend/tests/test_integrity.py`:
`test_update_record_rejects_status_payload` — PATCH with
`{"status": "closed", "expected_version": N}` must either succeed while
leaving `status` unchanged (if Pydantic silently ignores unknown fields)
or return 422 (if extra fields are rejected). Configure the schema so
extra fields are rejected (`model_config = ConfigDict(extra="forbid")`
on `RecordUpdate`). The test asserts 422.

### 1B. Fix the Ready-for-Scheduling terminal flag

`backend/app/seed/seed_data.py` sets
`"Ready for Scheduling"` to `is_terminal: True`. `ARCHITECTURE.md`
states only `Blocked` and `Closed` are terminal.

Required change:

- Flip `is_terminal` to `False` for `ready_for_scheduling` in the seed.
- Confirm the rest of the seed data assumes this (search for any rule
  or requirement pinned to the ready-for-scheduling stage that depends
  on terminality).
- Do not change terminal semantics for `blocked` or `closed`.

If the change breaks an existing test, update the test to match the
corrected invariant.

### 1C. Remove dead column `Document.verified_content_hash`

`verified_content_hash` is written during verify but never read. Either
consume it or remove it.

Required change: **remove it.** It is not referenced by any service,
route, schema, or frontend type. Drop the column from the model, the
schema, and the frontend `DocumentRead` type. Add a migration step
(see Phase 3) — for now, just model-level change. The baseline
`create_all` will pick up the removal automatically; real migrations
come in Phase 3.

### 1D. Route `list_audit` and `get_workflow` through services

- `backend/app/api/routes/records.py::list_audit` constructs its own
  SQLAlchemy query inline. Move this into
  `audit_service.list_for_record(db, record, limit=limit)`; the route
  calls the service.
- `backend/app/api/routes/workflows.py::get_workflow` calls the
  repository directly and does the org scope check in the route. Add
  `workflow_service.get_workflow_for_actor(db, actor, workflow_id)`
  that returns `None` on missing / cross-org; route translates `None`
  to 404.

### 1E. Consolidate the stage-belongs-to-workflow check

`record_service._load_stage_for_workflow` and
`workflow_service._load_target_stage` are the same function. Extract to
`workflow_repository.get_stage_for_workflow(db, workflow_id, stage_id)`
that raises `StageNotFound` / `StageWorkflowMismatch` (move the
exceptions to a shared location — either `record_service` keeps owning
them and `workflow_repository` imports, or both move to a new
`app.services.exceptions` module; pick the less-disruptive option).

Both callers now use the repository helper. Existing tests must still
pass unchanged.

### Gate

- `pytest` passes with all new tests green.
- `grep -r "verified_content_hash" backend frontend` returns no hits.
- Commit: `phase 1: close record-update status hole, fix terminal flag,
  consolidate stage checks`

---

## Phase 2 — Audit chain hardening

**Goal:** make the tamper-evidence claim test-locked, add the missing
index, and cover the replay guard.

### 2A. Composite index on audit_logs

Add `Index("ix_audit_logs_org_id", "organization_id", "id")` to
`AuditLog.__table_args__`. This accelerates `_latest_hash_in_scope`
(walks descending id per org on every audit write) and `verify_chain`
(ordered per-org scan).

### 2B. Tamper-evidence test

Add `backend/tests/test_audit_chain.py` (new file):

1. `test_verify_chain_detects_mutated_payload` — seed some audit rows
   through the service, then reach into the session and mutate a
   middle row's `payload` JSON directly, flush. Call
   `audit_service.verify_chain`. Assert `ok is False`, assert the
   mutated row's id appears in `broken_entries`.
2. `test_verify_chain_detects_mutated_previous_hash` — same shape, but
   mutate `previous_hash` on a middle row. Assert the id appears in
   `broken_links`.
3. `test_verify_chain_happy_path` — clean chain, `ok is True`,
   `broken_entries == []`, `broken_links == []`.

Use the existing `db_session` fixture, seed the chain inside the test.
Do not rely on the broad demo seed for this — isolate it.

### 2C. Replay guard concurrency test

Add `backend/tests/test_content_access_guard.py`:

- `test_signed_jti_single_use_under_race` — spawn 16 threads that all
  call `consume_signed_access_jti(jti, exp)` with the same jti. Assert
  exactly one returns True. (Use `threading` + a `Barrier` to start
  all threads at once.)
- `test_signed_jti_grace_window_allows_immediate_reuse` — two
  sequential calls within the 2s grace window both return True; a
  third call after the window returns False. Monkeypatch `time.time`
  rather than sleeping in real time.
- `test_signed_jti_rejects_expired_entries` — call with an `exp` in
  the past; assert the entry is evicted on the next call for a
  different jti.

### 2D. Expired signed-token endpoint test

Add to `backend/tests/test_documents.py` (or its phase analog):
`test_signed_access_rejects_expired_token` — mint a token with
`ttl_seconds=1`, wait (monkeypatch or use `freezegun` if already
available; otherwise advance by adjusting the `exp` claim at test time
via a small helper). Assert the `/documents/content/signed` endpoint
returns 401 with detail mentioning "expired".

Do not add `freezegun` if it's not already in `requirements.txt`.
Instead, mint the token via `create_content_access_token` and then
patch `jwt.decode`'s reference `time.time` — or simpler, call
`jwt.encode` with an `exp` in the past directly, bypassing
`create_content_access_token` for this one test.

### Gate

- All new tests pass.
- `pytest` total passes.
- Commit: `phase 2: audit chain tests, composite index, replay-guard
  coverage`

---

## Phase 3 — Real Alembic migrations

**Goal:** replace the `create_all` baseline with explicit table DDL, so
the schema is properly versioned.

This phase is invasive. If anything is unclear, stop and ask.

### 3A. Generate the baseline

1. With the current models (including Phase 1 changes), drop the
   existing baseline migration `0001_initial_schema.py`.
2. Run `alembic revision --autogenerate -m "initial schema"` against a
   clean database (SQLite is fine for generation; then sanity-check
   against Postgres).
3. Review the generated migration by hand. Every table, index,
   constraint, and enum in the models must appear. Pay specific
   attention to:
   - `uq_rule_workflow_code`
   - Both partial unique indexes on `document_requirements`
     (`uq_doc_req_workflow_global_type` and
     `uq_doc_req_workflow_stage_type`) — these need `postgresql_where`
     and `sqlite_where` in the migration.
   - Native enum types (all the `enums.py` types).
   - The new `ix_audit_logs_org_id` from Phase 2.
4. Commit the hand-reviewed migration as `0001_baseline.py`.

### 3B. Smoke test the migration

Add `backend/tests/test_migrations.py`:

- `test_migration_upgrades_from_empty` — create a fresh SQLite
  engine, run `alembic upgrade head` against it, verify every
  expected table exists.
- `test_migration_downgrade_is_clean` — `upgrade head` then
  `downgrade base`, assert zero tables remain.

Mark these `@pytest.mark.migration` (the marker already exists in
`pytest.ini`).

### 3C. Update docs

- `docs/migrations.md` — describe the new baseline and the workflow
  for future schema changes (`alembic revision --autogenerate`, review
  by hand, never `create_all` in production).
- `ARCHITECTURE.md` — update the paragraph that mentions the
  `create_all` baseline to reflect the real migration.

### Gate

- `alembic upgrade head` succeeds on a fresh Postgres.
- `alembic upgrade head` succeeds on fresh SQLite.
- `pytest` passes, including the new migration tests.
- Commit: `phase 3: replace create_all baseline with real alembic
  migration`

---

## Phase 4 — Observability

**Goal:** add structured logging with request ids, and a minimal
metrics endpoint.

### 4A. Structured logging + request id

Add `backend/app/core/logging.py`:

- `configure_logging()` — call from `create_app()`. Emits JSON lines
  to stdout when `APP_ENV != "development"`, human-readable otherwise.
  Fields: `timestamp`, `level`, `msg`, `request_id`, `method`, `path`,
  `status`, `duration_ms`, `actor_id` (when available).
- No new dependencies. Use `logging` + a small JSON formatter.

Add a FastAPI middleware in `app/main.py`:

- Generate a request id (`uuid4().hex[:16]`) if the incoming request
  lacks `X-Request-Id`; otherwise honor the client value (only in
  dev-like environments — in production, always generate fresh, so
  clients cannot forge ids).
- Put the id in a `contextvars.ContextVar` so log records can pick it
  up via a logging filter.
- Time the request, log one line on response with the fields above.
- Echo the request id in the `X-Request-Id` response header.

### 4B. Metrics endpoint

Add `GET /metrics` — plain text, Prometheus exposition format, no
external dependencies. Track:

- `veriflow_http_requests_total{method,path_template,status}` counter
- `veriflow_http_request_duration_seconds` histogram (default buckets)
- `veriflow_audit_write_total` counter
- `veriflow_audit_verify_duration_seconds` histogram
- `veriflow_evaluation_duration_seconds` histogram

Keep the implementation tiny — a module-level dict of counters and a
simple histogram bucket counter is fine. Do NOT add
`prometheus-client` unless you confirm with me.

The endpoint is unauthenticated (standard Prometheus posture) but
should be CSP-exempt so text/plain renders correctly, and should not
leak any organization- or user-scoped data. Label cardinality: use
FastAPI's path *template* (`/api/records/{record_id}`), not the
expanded URL.

### 4C. Health endpoint split

Rename the current `/health` to `/health/liveness` (trivial
always-200) and leave `/health/readiness` as-is. Keep `/health` as an
alias of `/health/liveness` for backward compatibility — add a test
that documents the alias so it isn't accidentally removed.

### Gate

- `pytest` passes.
- `curl http://localhost:8000/metrics` returns a valid Prometheus
  document (test this in a smoke test).
- Every response carries `X-Request-Id`.
- Commit: `phase 4: structured logging, request ids, /metrics`

---

## Phase 5 — Design system foundation (frontend, no visual changes yet)

**Goal:** lay the theming, color, and motion foundations the polish
phases will build on. **This phase should produce no visible change to
any existing screen.** If something looks different at the end of this
phase, you've overreached.

### 5A. Introduce CSS custom properties for theme tokens

Create `frontend/app/theme.css` (imported from `globals.css`):

- Define the full token set under `:root` (light theme, default) and
  `html[data-theme="dark"]` (dark theme). Tokens:
  - `--color-bg` (page background)
  - `--color-bg-elevated` (panel / card)
  - `--color-bg-sunken` (section dividers)
  - `--color-surface-border`
  - `--color-surface-muted`
  - `--color-text`
  - `--color-text-muted`
  - `--color-text-subtle`
  - `--color-brand-50` through `--color-brand-900` (teal ramp —
    preserve the current teal as the mid-range; add legitimate light
    and dark shades around it)
  - `--color-accent-from`, `--color-accent-to` (gradient endpoints)
  - `--color-danger`, `--color-warning`, `--color-success`,
    `--color-info` (each with `-bg` and `-border` variants)
  - `--shadow-sm`, `--shadow-md`, `--shadow-lg` (theme-aware —
    different opacity in light vs dark)
  - `--radius-sm` (4px), `--radius-md` (8px), `--radius-lg` (12px),
    `--radius-xl` (16px)

Important: the current dark mode is what the app ships with today. The
new **default is light**; the **dark theme matches today's look as
closely as possible**, so flipping to dark produces something visually
equivalent to current main.

### 5B. Rewrite Tailwind to consume tokens

Update `frontend/tailwind.config.ts`:

- Under `theme.extend.colors`, map every existing brand/surface/text
  color to the CSS variable form: `"brand-500": "rgb(var(--color-brand-500) / <alpha-value>)"` etc.
- Store token values as space-separated RGB channels in `theme.css`
  (e.g. `--color-bg: 250 250 249;` not `--color-bg: #fafaf9;`) so
  Tailwind's `/<alpha-value>` syntax works.
- Add `extend.borderRadius`, `extend.boxShadow` mapped to the tokens.

Do not change any class names in any component yet. The existing
Tailwind classes must continue to produce the current visual result —
just sourced from variables now.

### 5C. Theme provider + persisted toggle (not yet mounted)

Create `frontend/components/theme/ThemeProvider.tsx`:

- Reads `localStorage.getItem("veriflow.theme")` on mount; if absent,
  honors `prefers-color-scheme`.
- Sets `document.documentElement.dataset.theme` to `"light"` or
  `"dark"`.
- Exposes a `useTheme()` hook returning `{ theme, setTheme, toggle }`.
- Suppresses the theme flash: add a tiny inline script in
  `app/layout.tsx` that runs before hydration and sets the
  `data-theme` attribute from `localStorage` / media query.

Do not mount the provider yet. Add it to `app/layout.tsx` (wrapping
`children`) but do not add the toggle UI yet — that lands in Phase 7.

### 5D. Motion vocabulary expansion

Extend `frontend/lib/motion.ts`:

- Add `MOTION_PRESETS` — a frozen record keyed by intent:
  `"fadeRise"`, `"fadeRiseSlow"`, `"slideUp"`, `"slideDown"`,
  `"scaleIn"`, `"dialogPop"`, `"overlayFade"`, `"listStagger"`.
  Each preset is an object `{ initial, animate, exit?, transition }`.
- Add a `useMotionPreset(name)` hook that honors `useReducedMotion()`
  and returns the preset with `transition: { duration: 0 }` in the
  reduced case.
- Keep every existing export; do not break existing call sites.

Document the presets in a new `docs/motion.md` — list each preset,
when to use it, and the reduced-motion behavior.

### Gate

- `npm run build` passes.
- `npm run dev` — the app looks **identical** to main. No color shift,
  no motion change, no layout change.
- `npx playwright test` passes.
- Commit: `phase 5: theme tokens and motion foundations (no visual
  change)`

---

## Phase 6 — Theme migration (light default, dark parity)

**Goal:** switch every component to the token system and ship a real
light theme. Dark remains a visual equivalent of current main.

### 6A. Sweep components

Go through every file under `frontend/components/` and
`frontend/app/`. Replace hard-coded color classes that don't already
live in the token system with token-backed equivalents. Example: a
`bg-zinc-900` becomes `bg-surface-panel` (which maps to
`var(--color-bg-elevated)`).

Do NOT:

- Introduce new component designs in this phase.
- Change layout, spacing, or typography.
- Touch motion or gradients.

Do:

- Every surface color goes through a token.
- Every text color goes through a token.
- Every border color goes through a token.
- Every shadow goes through a token.

### 6B. Light-theme values

Design the light theme with these constraints:

- Background is an off-white (`rgb(250 250 249)` — warm, not pure
  white) so the eye doesn't fatigue.
- Elevated surfaces are pure white (`rgb(255 255 255)`) with a subtle
  border rather than a shadow.
- Brand teal stays the same hue, slightly deeper in light mode for
  AA contrast on white.
- Risk colors: danger / warning / success must pass WCAG AA (4.5:1)
  against the elevated surface in both themes. Pick two distinct
  palettes per state, not one shared.
- Text: primary `rgb(28 25 23)`, muted `rgb(87 83 78)`, subtle
  `rgb(120 113 108)`.

### 6C. Dark-theme values

Port today's dark colors into the token system. Goal: visiting the app
in dark mode after this phase looks identical to visiting main. Take
a screenshot before you start and diff it against the final dark-mode
render.

### 6D. Visual regression check

Run the Playwright suite. If any `aria-*`, heading, or role assertion
fails, you've over-changed something. Fix it by reverting the
structural part of the change, not by editing the test.

### Gate

- Light theme and dark theme both render cleanly across: landing,
  `/dashboard`, `/records`, `/records/[id]`, `/operations`,
  `/login`, `/enter`.
- Playwright: reduced-motion spec passes (still 3 specs green).
- `pa11y` / axe-core spot-check of dashboard and record detail in
  both themes: 0 serious or critical issues. (If neither is already
  installed, skip this check but do a manual review.)
- Commit: `phase 6: token-based theme system with light default and
  dark parity`

---

## Phase 7 — Theme toggle + motion polish

**Goal:** expose the toggle, and raise the motion quality of the
existing surfaces without adding gratuitous animation.

### 7A. Theme toggle

Build `frontend/components/theme/ThemeToggle.tsx`:

- A proper two-state segmented toggle, not a tiny icon. Sized so the
  label is legible (approx 88px × 36px). Shows a sun icon and a moon
  icon with a sliding pill that indicates the active state.
- Accessible: `role="radiogroup"`, each option is a `role="radio"`,
  keyboard-operable (left/right arrow keys switch; Enter/Space
  selects), `aria-checked` on the active option.
- Smooth pill slide via Framer Motion (`layoutId`) honoring reduced
  motion.
- Honors the system preference as the initial state if nothing is
  stored yet.

Mount it:

- On the landing page (`app/page.tsx`) — top-right of the hero, large
  enough to be unambiguous. This is the user's visible option.
- Inside `AppShell` — a smaller, icon-only variant in the header next
  to the user menu, so the toggle remains available inside the
  authenticated app.

### 7B. Gradient accents (restrained)

Add three gradient tokens:

- `--gradient-hero` — used behind the landing hero headline only.
  Light mode: a near-white-to-brand-50 horizontal wash. Dark mode:
  brand-900-to-surface-black.
- `--gradient-cta` — used on the primary CTA button only.
  Brand-500-to-brand-600 at 135deg. Hover: brand-600-to-brand-700.
- `--gradient-accent-ring` — used on the active stage ring in the
  workflow timeline only. Brand-400-to-brand-600.

Do NOT put gradients on panels, table rows, hero cards, or navigation.
Gradients are an accent, not a skin. Three uses, total.

### 7C. Motion upgrades on existing surfaces

Apply motion only where it communicates state. Specific call sites:

1. **Dashboard KPI cards** — currently fade in. Add a subtle
   `layoutId`-driven reorder animation when the poll changes the
   count-up values. No bouncy spring; use `easeOut`, 220ms. Reduced
   motion: instant value swap.
2. **Needs-attention table on dashboard** — rows that *leave* (no
   longer need attention after a poll) should fade out and slide
   right 8px before removal. Rows that *enter* (newly blocked) should
   slide in from the left with a 120ms delay stagger. Use
   `AnimatePresence` with `mode="popLayout"`.
3. **Workflow timeline** — when a transition lands and the current
   stage changes, animate the active-stage ring between the old and
   new nodes using a shared `layoutId`. Keep the existing
   scale-in for the first render.
4. **Evaluation panel** — when the decision changes
   (blocking / warning counts shift), animate the risk score
   count-up (300ms, `easeOut`) and cross-fade the can-progress /
   blocked chip (180ms). Reduced motion: instant.
5. **Toast stack** — add a slight `y: 4` rise on enter. Exits fade
   and slide down 4px. Already mostly there — just polish the
   transition easing curve.
6. **Record detail page mount** — stagger the top-level panels
   (`RecordHeader`, `ActionBar`, `EvaluationPanel`,
   `WorkflowTimeline`, `DocumentEvidencePanel`, `AuditTrail`) with
   40ms between. 240ms fade-rise per panel. One-shot on mount,
   not on every data refresh.

Do NOT add:

- Hover animations on every button.
- Scroll-linked animations.
- Parallax anywhere.
- Any animation that plays on every re-render.
- Sparkles, confetti, or "hero" scroll reveals beyond what the
  landing page already has.

Every animated surface must consult `useReducedMotion()` and collapse
to an instant state change. Audit the result: grep the codebase for
`motion.` and confirm every hit is within 2 lines of `useReducedMotion`
or uses a preset from `lib/motion.ts` (presets already honor the
reduce flag).

### 7D. Update motion audit doc

Add a new section to `docs/ui_motion_audit.md` cataloguing every new
animation call site, its preset, and its reduced-motion behavior.

### Gate

- Playwright suite passes, including reduced-motion spec. Add two new
  specs: theme toggle keyboard-operability, and theme persistence
  across reload.
- Visual review: light mode looks intentional, dark mode looks
  unchanged from Phase 6, gradients appear in exactly the three
  documented places.
- Commit: `phase 7: theme toggle, restrained gradients, motion polish`

---

## Phase 8 — Frontend plumbing, testing, and final sweep

**Goal:** close the remaining frontend findings and make sure nothing
from earlier phases regressed.

### 8A. Token storage migration

Move session tokens off `localStorage`:

- Backend: add a login path that also sets an HTTP-only cookie
  (`Secure` when `APP_ENV != "development"`, `SameSite=Strict`,
  `Path=/api`). Keep the JSON response for now so the frontend has
  both options during rollout. Add a rotation endpoint
  (`POST /api/auth/rotate`) that reissues the token with the same
  cookie posture.
- `get_current_user` accepts either the `Authorization: Bearer` header
  *or* the cookie. Prefer the cookie.
- Frontend: update `lib/auth.ts` to stop reading/writing the token in
  localStorage. Keep a small `readUser()` using a non-sensitive
  profile cache (from `/api/auth/me`) so the shell can render the
  user's name without blocking. Sign-out clears both the cookie (via
  a new `POST /api/auth/logout`) and the profile cache.
- Update every `lib/api.ts` call to use `credentials: "include"`.
- Update CORS: `allow_credentials=True` is already set; confirm
  `CORS_ORIGINS` is restrictive (one explicit origin, not `*`).

Add tests:

- `test_login_sets_cookie_and_body_token` — both present.
- `test_cookie_auth_permits_authenticated_request` — request with
  only the cookie succeeds.
- `test_logout_clears_cookie` — response includes a
  `Set-Cookie: veriflow.session=; Max-Age=0`.

### 8B. AbortController in the API client

Refactor `frontend/lib/api.ts` so every call accepts an optional
`AbortSignal`. Dashboard polling: when the effect cleans up (unmount,
visibility change), abort any in-flight fetch. Record-detail page:
same treatment for the parallel loader.

### 8C. Decision endpoint

Add `GET /api/records/{id}/decision` to the backend, returning the
same `EvaluationDecisionRead` shape as `/evaluate` but **without**
running evaluation or mutating anything — purely a read over the
current `rule_evaluations` + record state.

Frontend: replace the client-side `derivedDecision` reconstruction in
`app/(app)/records/[id]/page.tsx` with a call to this endpoint.
Delete the `derivedDecision` logic. Keep the behavior of using the
most recent `decision` state if the user has just clicked Evaluate
(that's still live data).

### 8D. Custom hooks to tame the record detail page

Pull handlers out of `app/(app)/records/[id]/page.tsx` into:

- `useRecordData(recordId)` — loader + refresh, abort handling.
- `useRecordActions(record, refresh)` — evaluate, transition, upload,
  verify, reject, delete, integrity check, download, preview.
- `usePreview()` — the preview overlay state + return-focus logic.

The page component should drop below 250 lines. No behavior changes.

### 8E. Upload in the shared client

Collapse `uploadMultipart` in `lib/api.ts` into a branch of
`request<T>` keyed by the body type (FormData vs JSON object). One
typed entry point.

### 8F. Sweep remaining findings

- Confirm `_evict_expired_locked` breaks on first non-expired entry
  (insertion-ordered is close enough to exp-ordered when TTLs are
  uniform, which they are). Add a comment explaining the invariant.
- Cross-reference `docs/` files from the README. Add a
  `docs/README.md` index that links everything under `docs/`.
- Confirm `WorkflowStage → Rule` cascade: downgrade from
  `all, delete-orphan` to `all, save-update` so deleting a stage
  *doesn't* silently delete rules. Add a service-layer check that
  refuses to delete a stage with live rules, returning a clear error.
  Add a test.

### 8G. Full regression

Run:

- `cd backend && python -m pytest` — every test green.
- `cd frontend && npm run build` — clean.
- `cd frontend && npx playwright test` — every spec green, including
  the two new theme specs from Phase 7.
- Manual: walk landing → login → dashboard → records list → record
  detail → operations in both themes, with reduced motion on and off,
  in both a narrow and a wide viewport.

### Gate

- Every test passes.
- The manual walk reveals no visual regressions and no broken flows.
- Commit: `phase 8: cookie auth, abort signals, decision endpoint,
  record-detail refactor, docs sweep`

---

## Final deliverable

When Phase 8 is complete, write a `CHANGELOG.md` at the repo root
covering what landed in each phase, broken down by:

- Backend integrity fixes
- Theming
- Motion
- Observability
- Auth posture
- Test coverage additions

Do NOT rewrite `CLAUDE.md`. Do NOT claim "A+" or "perfect" in any doc
— those are the operator's claim to make, not yours. Describe the work
precisely, without superlatives.

---

## If you drift

You will drift. When you catch yourself adding something the phase
didn't ask for, stop and revert that specific change. Phases are
bounded on purpose. A phase that over-delivered is a phase that needs
review before the next one starts.

If a phase's test gate fails, do not proceed. Fix the failure, then
proceed. If the failure is ambiguous, stop and ask.
