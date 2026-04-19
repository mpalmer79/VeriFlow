Hardening pass committed (`af83828`) and pushed. **62 tests passing**.

## Summary

### What was cleaned up
- Nothing to remove from the repo root or `docs/` — no `CLAUDE.md`, `docs/build.md`, `docs/results.md`, logs, or prompt-history files were present. The repo was already clean on that front.
- README rewritten for professional framing: clearer capabilities section, expanded repo layout, and demo credentials moved to a dedicated **Local Demo Access** section that labels them explicitly, warns about non-local use, and points to the seed constant.
- `ARCHITECTURE.md` got a new **Known Tradeoffs** section that names the hybrid flag/document evaluation, the deliberately deferred rule-engine DSL, the reserved-but-inert `applies_when_code`, the current-state `rule_evaluations` contract, the canonical audit-payload module, and the SQLite-in-tests limitation.
- `docs/document_evidence.md` updated to describe the new status partition and the uniqueness strategy.

### Schema issue that was fixed
`DocumentRequirement` had a composite `UniqueConstraint` across `(workflow_id, stage_id, document_type)`. Because `stage_id` is nullable and PostgreSQL treats `NULL` as distinct, two workflow-global requirements for the same `(workflow, document_type)` could coexist.

Replaced with **two partial unique indexes** (enforced in both Postgres and SQLite via `postgresql_where` / `sqlite_where`):
- `uq_doc_req_workflow_global_type` — `stage_id IS NULL` ⇒ unique on `(workflow_id, document_type)`
- `uq_doc_req_workflow_stage_type` — `stage_id IS NOT NULL` ⇒ unique on `(workflow_id, stage_id, document_type)`

This is now DB-enforced; no service-layer pre-check needed.

### Document-status semantics
The endpoint now exposes an explicit partition of the requirement surface:

- `required_types = satisfied_types + missing_types` (invariant, disjoint)
- A requirement is **only** satisfied by a verified document. Uploaded-but-not-verified appears in `present_types` but *not* `satisfied_types`, and it still counts as `missing` until verified.
- `rejected_types` is historical — it lists any type with at least one rejected document, even if a later verified one exists. Previously it required "all docs rejected" which produced confusing overlaps.
- Added `satisfied_types` to both `DocumentStatusSummary` and the HTTP response schema.

### Files removed, moved, or retained
- **Removed**: none (nothing qualified as process noise).
- **Moved/renamed**: none.
- **Retained**: all existing docs (`ARCHITECTURE.md`, `docs/product_overview.md`, `docs/workflow_rules.md`, `docs/document_evidence.md`, `frontend/README.md`) — each still earns its place in a portfolio-facing repo.

### Known limitations before frontend work
- **CI matrix is SQLite-only.** The partial-unique-index fix is exercised in tests via SQLite's own partial-index support, but a PostgreSQL CI job is still the right next hardening step.
- **Document storage.** `Document.storage_uri` remains a placeholder string. Real object-storage integration (S3/GCS/minio) is deferred.
- **Conditional document requirements** (`applies_when_code`) are persisted but inert — the minor check still lives in the evaluator. A tiny resolver can replace this when there's a second use case.
- **Role-based authorization is coarse.** `get_current_user` authenticates; `require_roles` exists but no route uses it yet. Worth revisiting before exposing verify/reject to non-reviewer roles.
- **Frontend is still a scaffold.** API contracts are stable; the UI is next.
