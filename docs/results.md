Phase 4 committed (`351a39d`) and pushed. Frontend build succeeds, all 62 backend tests still pass.

## Summary

### Pages built
- **`/login`** — working auth form, includes a local demo-access helper that lists the four seeded accounts with "Use this" buttons. Redirect-aware via `?next=`.
- **`/dashboard`** — four stat cards (total, in-progress, blocked, high/critical risk) plus a "records needing attention" table and a recent-records panel.
- **`/records`** — records table with search (name/reference), stage filter, risk-band filter, and status filter. Blocked rows carry a left severity accent.
- **`/records/[id]`** — the centerpiece. Header with stage/status/risk, action bar (run evaluation, attempt transition, refresh), decision summary with blocking vs warning panels, workflow stage timeline, document evidence panel (required/satisfied/present/missing/rejected counts plus per-type sub-panels with inline **Verify** / **Reject** buttons), and audit trail rendered from canonical event payloads.

### Auth
- `lib/auth.ts` stores the JWT in `localStorage` (keyed `veriflow.token`, user cached at `veriflow.user`).
- `lib/api.ts` injects the bearer token on every request and throws `ApiError(status, detail)`.
- `AppShell` client component guards the `(app)` route group: on mount it reads the token, redirects to `/login?next=…` if absent, and renders the header with signed-in user + sign-out.
- README explicitly labels this as MVP-safe and notes to switch to HTTP-only cookies before hosting.

### Actions on the detail page
- **Run evaluation** — `POST /records/{id}/evaluate`, updates decision and refreshes all panels.
- **Attempt transition** — choose a target stage, `POST /records/{id}/transition`. Shows blocked vs completed feedback with the new stage name.
- **Verify document** — `POST /documents/{id}/verify`, refetches status.
- **Reject document** — prompts for a reason, `POST /documents/{id}/reject`, refetches.
- Every action emits a status banner and refreshes record, document-status, audit, and evaluations together.

### Minimal backend additions (justified)
- `GET /api/workflows/{id}` so the detail page can show stage names in the timeline.
- `GET /api/records/{id}/audit` so the audit trail panel is real, not mocked.

### Known limitations left for future polish
- **`assigned_user_id` is rendered as `User #{id}`** — a `/api/users` listing or embedded `assigned_user_name` on `RecordRead` would make this readable.
- **Document upload UI is not built**. The backend supports `POST /records/{id}/documents` (metadata), but with no file-storage integration behind it, adding an upload form would be theatre. Verify/reject of existing seeded documents is sufficient to demonstrate the lifecycle.
- **Audit trail is per-record only** — no global audit view.
- **No pagination yet** on the records list (fetches `limit=500`); adequate for the demo-scale dataset.
- **No frontend tests**. The build check and type check are the guardrails; adding Playwright or Vitest was out of scope for this phase.
- **Rule codes on the detail page derive from `RuleEvaluationRow.rule_id`** (as `rule#N`) when shown from the persisted rows (first page load). After the user clicks **Run evaluation**, the fresh `EvaluationDecision` gives the real rule codes. A one-line backend addition (embed `rule_code` on `RuleEvaluationRead`) would remove that asymmetry.
