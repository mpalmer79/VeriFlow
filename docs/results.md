Polish pass committed (`7642c8f`) and pushed. **66 backend tests passing** (4 new). Frontend build succeeds.

## Summary

### What was polished

**Backend response quality (the foundation):**
- `RecordRead` now includes `assigned_user_name` — sourced from a small `@property` on the `Record` model that reads `assigned_user.full_name`. `record_repository` uses `selectinload(Record.assigned_user)` so list endpoints stay single-query.
- `RuleEvaluationRead` now includes `rule_code` and `rule_name` — sourced from properties on `RuleEvaluation` that read from the related `Rule`. `evaluation_service.current_evaluations` preloads `RuleEvaluation.rule`.
- Both payloads handle null cases cleanly (unassigned records emit `assigned_user_name: null`).

**Frontend consistency:**
- New shared `StageBadge` (with current/past/future/neutral tones) and `SeverityPanel` components. The inline stage pill on the detail page and the inline `IssueList` subcomponent were replaced so every page renders the same concepts identically.
- Dashboard "Needs attention" now fetches the workflow once to render stage names via `StageBadge`, and adds an "Assigned to" column using `assigned_user_name`.
- Records list shows `assigned_user_name` ("Unassigned" when null) instead of `User #N`.
- Record detail header renders `assigned_user_name` and the current stage via the shared `StageBadge`.
- Persisted evaluation rows now drive the initial decision view using the real `rule_code`/`rule_name`, so the detail page labels are identical before and after clicking **Run evaluation**.

**Copy and empty-state polish:**
- Dashboard titles and sublabels tightened ("Operations overview", "Needs attention", "Recently updated", "resolution required", "review recommended").
- Record detail: "Evaluation", "Workflow progress", and "Audit trail" panel descriptions rewritten; empty states made specific (e.g. "No audit history yet" with an explanation of when events will appear).
- Severity empty labels sharpened.

**Login helper presentation:**
- "Local demo access" now reads as a practical affordance: clear scope caveat, divided account list, neutral button copy ("Use email"), and the shared password relegated to a bottom-of-panel footer rather than shouted in the header.

### How assignee names are now exposed
`RecordRead.assigned_user_name: Optional[str]`. The detail header, dashboard "Needs attention" table, and records list all render this string directly, with `"Unassigned"` as the null fallback.

### How rule codes are now exposed
`RuleEvaluationRead.rule_code: str` and `rule_name: str`. The frontend's `RuleEvaluationRow` type carries both; the record detail page uses them when deriving the initial decision view from persisted rows, so there's no more `rule#N` fallback anywhere in the UI.

### Remaining presentation limitations before deployment/showcase
- **Document upload UI** is still not built. The backend accepts `POST /records/{id}/documents` (metadata), but no file-storage integration is wired, so adding an upload form without real storage would be theatre. Verify/reject of seeded documents already demonstrates the lifecycle.
- **No global audit view** — audit is per-record only.
- **No pagination** on the records list (fetches `limit=500`); fine for demo-scale data, worth adding before a real dataset.
- **No frontend test harness**. The build check and type check are the only guardrails.
- **Session is localStorage-backed**. Fine for local walkthrough, but switch to HTTP-only cookies before any hosted deployment.
- **Roles are authenticated but not authorized per route.** `require_roles` exists server-side but no route uses it; verify/reject currently accept any authenticated user from the org.
