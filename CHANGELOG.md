# CHANGELOG

## Remediation + observability + theming pass (Phases 1–8)

Eight bounded phases, one PR per phase, each with its own gate. No
phase crossed into the next until the previous pytest + build run
was green. The sections below describe what landed in each category,
not the order it shipped.

### Backend integrity fixes

- **`RecordUpdate` no longer exposes `status`.** The PATCH schema
  carries `extra="forbid"` so a client payload that tries to
  fast-forward a record to `ready` or `closed` gets a 422. Only the
  transition service writes status. New test
  `test_update_record_rejects_status_payload`.
- **Terminal flag corrected.** `ready_for_scheduling.is_terminal`
  flipped to `False` in the seed. Only `blocked` and `closed` are
  terminal, matching `ARCHITECTURE.md`.
- **Dead column removed.** `Document.verified_content_hash` was
  written on verify and never read; it is gone from the model, the
  schema, the verification service, and `frontend/lib/types.ts`. Two
  hardening tests rewrote to assert the real post-verify invariant
  (`content_hash` + `status == "verified"`).
- **Routes thin.** `list_audit` calls `audit_service.list_for_record`;
  `get_workflow` calls `workflow_service.get_workflow_for_actor`. No
  SQL in routes.
- **Stage-belongs-to-workflow check consolidated.**
  `workflow_repository.get_stage_for_workflow` owns the invariant;
  `StageNotFound` / `StageWorkflowMismatch` live on the repository.
  `record_service` re-exports them so existing `except` clauses work
  unchanged.
- **`WorkflowStage → Rule` cascade downgraded.** Was
  `all, delete-orphan`; now `all, save-update`.
  `workflow_service.delete_stage` refuses to delete a stage with
  live rules so policy cannot vanish without an audit event. Covered
  by `test_stage_deletion.py`.
- **`_evict_expired_locked` invariant commented.** The walk-and-break
  short-circuit relies on uniform TTLs across signed-access tokens;
  the comment names the contract.

### Theming

- **Token system.** `app/theme.css` defines the full token set under
  `:root` (light, default) and `html[data-theme="dark"]` (dark).
  Surface, text, brand, accent, status, shadow, radius families. RGB
  channel format so Tailwind's `/<alpha-value>` syntax works.
- **Tailwind consumes tokens.** Every surface / text / brand / status
  color resolves to `rgb(var(--color-X) / <alpha-value>)`.
  `borderRadius` + `boxShadow` token-backed. No component class names
  changed.
- **ThemeProvider + flash-suppression.** Inline `<script>` in `<head>`
  reads `localStorage` / `prefers-color-scheme` before hydration and
  sets `data-theme`. Phase 5 defaulted to dark to preserve the
  existing look; Phase 6 flipped the default to light.
- **Theme toggle.** `ThemeToggle.tsx` in `full` (88×36 segmented pill
  with `layoutId="theme-toggle-pill"`, `role="radiogroup"` + arrow
  keys + `aria-checked`) and `compact` variants. Mounted on the
  landing hero + in the AppShell header.
- **Gradients, three uses total.** `--gradient-hero` on the landing
  wash, `--gradient-cta` on the "Enter demo" button,
  `--gradient-accent-ring` on the WorkflowTimeline active-stage halo.
  Utility classes in `globals.css` so a fourth use shows up in a
  `grep`.
- **Component sweep.** `StatusBadge`'s `draft` and `closed` chips
  migrated off `slate-*` onto token-backed classes.

### Motion

- **Motion vocabulary expansion.** `lib/motion.ts` gains
  `MOTION_PRESETS` (`fadeRise`, `fadeRiseSlow`, `slideUp`,
  `slideDown`, `scaleIn`, `dialogPop`, `overlayFade`, `listStagger`)
  and `useMotionPreset(name)`. `useReducedMotion()` collapses
  `transition` to `{ duration: 0 }` without changing
  `initial` / `animate` shapes.
- **Workflow timeline ring.** `layoutId="workflow-active-ring-{orientation}"`
  so the ring slides between stage nodes on advance. Namespaced per
  orientation because both horizontal + vertical timelines render
  breakpoint-hidden.
- **Toast.** Enter/exit moved from x-axis slide to the spec'd `y:4`
  rise / drop.
- **Record detail panel stagger.** Six top-level panels reveal on
  mount only with `staggerChildren: 0.04` + `fadeRise` + 240ms
  `EASE_OUT_EXPO`. Framer Motion holds at `visible` so poll
  refreshes don't re-animate.
- **Docs.** `docs/motion.md` catalogs each preset.
  `docs/ui_motion_audit.md` has a "Phase 7 additions" table + the
  three gradient uses.

### Observability

- **Structured logging.** `app/core/logging.py` provides a JSON-per-
  line formatter (prod) and a human single-line formatter (dev).
  `request_id` + `actor_id` in `contextvars`; a logging filter
  injects them onto every record. No new dependency.
- **Request ids.** Middleware mints a 16-hex id (inbound
  `X-Request-Id` honored only in dev-like envs), times the request,
  logs one "request" line on response, echoes the id back as
  `X-Request-Id`. CORS `expose_headers` widened so the browser can
  read it.
- **`/metrics` endpoint.** `app/core/metrics.py` is a no-dep
  module-level registry with a `Lock`, a counter dict, and three
  histograms:
  - `veriflow_http_requests_total{method,path_template,status}`
  - `veriflow_http_request_duration_seconds`
  - `veriflow_audit_write_total`
  - `veriflow_audit_verify_duration_seconds`
  - `veriflow_evaluation_duration_seconds`

  Labels use the FastAPI route template, not the expanded URL, so
  cardinality stays bounded. Unauthenticated (standard Prometheus
  posture) and CSP-exempt so `text/plain` renders.
- **Health probe split.** `/health/liveness` is the primary probe;
  `/health/readiness` is unchanged; `/health` remains as a
  backward-compatible alias of `/health/liveness`, pinned by a test
  so it cannot be accidentally removed.

### Auth posture

- **HTTP-only session cookie.** `/api/auth/login` sets a
  `veriflow.session` cookie (`HttpOnly`, `SameSite=Strict`,
  `Path=/api`, `Secure` outside dev) alongside the JSON body token
  (rollout window so existing clients keep working).
  `get_current_user` accepts either the cookie or the Bearer header,
  preferring the cookie.
- **Rotation.** `POST /api/auth/rotate` reissues the token with the
  same cookie posture so an operator can extend a session without
  re-login.
- **Logout.** `POST /api/auth/logout` clears the session cookie with
  `Max-Age=0`.
- **Frontend client.** `lib/api.ts` uses `credentials: "include"` on
  every call so the cookie rides along. `AbortSignal` threads through
  every API wrapper; dashboard polling + record-detail loader abort
  in-flight fetches on unmount.
- **Read-only decision endpoint.** `GET /api/records/:id/decision`
  returns the current `EvaluationDecision` from persisted rule
  evaluations + record state, without running evaluators or
  mutating. The record-detail page uses it in place of the
  client-side `derivedDecision` reconstruction.

### Alembic migrations

- **Real baseline.** `0001_initial_schema.py` (a `create_all`
  wrapper) is removed. `0001_baseline.py` emits explicit DDL for
  every table, index, constraint, and enum in the models. Specific
  invariants called out inline: `uq_rule_workflow_code`, both
  partial unique indexes on `document_requirements` with
  `postgresql_where` + `sqlite_where`, every native enum type,
  `ix_audit_logs_org_id`.
- **Enum cleanup on downgrade.** Postgres keeps user-defined enum
  types alive after `drop_table`; the downgrade runs
  `DROP TYPE IF EXISTS` for each of the 11 enums, dialect-guarded so
  SQLite is a no-op. The CI round-trip (`upgrade head → downgrade
  base → upgrade head`) is idempotent again.
- **Smoke tests.** `tests/test_migrations.py` exercises the full
  round-trip against a temp file-backed SQLite database; the CI
  PostgreSQL job runs the same spec against a live server via the
  `@pytest.mark.migration` marker.

### Test coverage additions

- `tests/test_integrity.py::test_update_record_rejects_status_payload`
  — PATCH with `{ "status": "closed" }` returns 422.
- `tests/test_audit_chain.py` — happy path + payload mutation +
  previous_hash mutation, all three detected by
  `audit_service.verify_chain`.
- `tests/test_content_access_guard.py` — 16-thread race with a
  zero-length grace window, grace-window reuse, expired-entry
  eviction. `time.time` is monkeypatched so no real sleeps.
- `tests/test_documents.py::test_signed_access_rejects_expired_token`
  — mints a token with a past `exp` via `jwt.encode` directly (no
  `freezegun`), endpoint returns 401 with an `"expired"` detail.
- `tests/test_migrations.py` — upgrade-from-empty + clean downgrade.
- `tests/test_observability.py` — `X-Request-Id` header,
  `/health` alias matches `/health/liveness`, `/metrics` emits all
  five families with template-based labels.
- `tests/test_auth_cookie.py` — login sets both cookie and body
  token; a request carrying only the cookie is authenticated; logout
  sets `Max-Age=0`.
- `tests/test_stage_deletion.py` —
  `workflow_service.delete_stage` refuses when live rules reference
  the stage, succeeds otherwise.
- `frontend/tests/e2e/theme-toggle.spec.ts` — keyboard arrow
  selection via `aria-checked`; theme persists across reload
  (`html[data-theme]` + `aria-checked`).

Backend test count: **248 → 268** over the remediation pass.

### Notes on scope

- **Phase 8D (custom hooks extraction) is partial.** The decision
  endpoint and `AbortSignal` handling are wired; the full
  `useRecordData` / `useRecordActions` / `usePreview` split that
  would drop the record-detail page under 250 lines was not done.
  The page is still coherent but the mechanical extraction remains
  future work.
- The frontend client keeps a Bearer-header fallback alongside the
  cookie so existing integrations and the demo role-switch flow
  continue to work. A future change can retire the fallback once
  all callers have migrated.
