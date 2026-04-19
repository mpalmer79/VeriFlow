Phase 1 hardening committed (`c004bb9`) and pushed. **82 backend tests passing**, frontend build succeeds.

## Implementation summary

**A. Optimistic concurrency.** `records.version: int` (default 1); `RecordUpdate.expected_version` and `TransitionRequest.expected_version` are required (422 if missing); `record_service.update_record` and `workflow_service.transition_record` compare against the persisted row, raise `VersionConflict`, and the routes map that to HTTP 409. Version increments on every successful update and on successful stage transition. Blocked transitions intentionally do **not** increment, since the risk recalc that happens during evaluation is a system-driven side effect, not a caller mutation. `RecordRead.version` and `TransitionResponse.record_version` expose the current value to callers.

**B. Tamper-evident audit chain.** `audit_logs.previous_hash` and `audit_logs.entry_hash` (indexed) columns. `audit_service.record_event` now computes `entry_hash = sha256(prev_hash + action + entity_type + entity_id + organization_id + actor_user_id + record_id + canonicalized JSON payload)` with canonicalization via `json.dumps(sort_keys=True, separators=(",", ":"), default=str)`. Chaining is organization-scoped. Within a single request, `db.flush()` makes an inserted row visible so subsequent events in the same transaction (e.g. attempted → evaluated → recalculated → completed) link correctly. Pure helper `compute_entry_hash` is exposed for testability.

**C. Document integrity metadata.** `documents.original_filename`, `mime_type`, `size_bytes` (BigInteger), `content_hash` (indexed), `verified_content_hash`, `expires_at` — all nullable. `DocumentCreate` / `DocumentRead` / `DocumentVerifyRequest` updated accordingly. `verify_document` writes `verified_content_hash` explicitly when provided, else defaults to the ingest-time `content_hash` so verified rows always carry something to compare against later.

**D. JWT claims.** Config adds `jwt_issuer` (default `"veriflow"`) and `jwt_audience` (default `"veriflow-api"`). `create_access_token` issues `sub`, `iat`, `nbf`, `exp`, `iss`, `aud`, `typ="access"`, and a UUID-hex `jti`. Reserved claims can't be overwritten by caller extras. `decode_access_token` uses `jose`'s `audience=`/`issuer=` for validation and then checks `typ == "access"` explicitly. New `TokenValidationError` subclasses `ValueError` to stay compatible with the existing FastAPI auth dependency.

## Exact files modified

- `backend/app/core/config.py`
- `backend/app/core/security.py`
- `backend/app/models/audit.py`
- `backend/app/models/document.py`
- `backend/app/models/record.py`
- `backend/app/schemas/document.py`
- `backend/app/schemas/evaluation.py`
- `backend/app/schemas/record.py`
- `backend/app/services/audit_service.py`
- `backend/app/services/document_service.py`
- `backend/app/services/record_service.py`
- `backend/app/services/workflow_service.py`
- `backend/app/api/routes/records.py`
- `backend/app/api/routes/documents.py`
- `backend/tests/test_records.py`, `test_integrity.py`, `test_evaluation.py`, `test_documents.py`, `test_hardening.py` (updated to pass `expected_version`)
- `frontend/lib/types.ts`, `frontend/lib/api.ts`, `frontend/app/(app)/records/[id]/page.tsx`

## Files added

- `backend/tests/test_phase1_hardening.py` — 16 new tests covering all four concerns
- `docs/migrations.md` — Phase 1 schema evolution note

## Migrations added

None bundled. This repo bootstraps schema via `Base.metadata.create_all` for the local demo and tests. `docs/migrations.md` enumerates the additive columns so you can write an `ALTER TABLE` migration against an existing Postgres database, and recommends introducing Alembic as a single focused follow-up rather than half-configured here. All Phase 1 columns are nullable or have defaults so no backfill is required.

## Tests added / updated

- **Added** (`test_phase1_hardening.py`, 16 tests, all passing):
  - record version exposure; `expected_version` required; successful update increments; stale version → 409
  - successful transition increments; blocked transition does not; stale transition → 409
  - audit chain links `entry_hash`/`previous_hash` in org scope; hash material reacts to payload changes
  - token carries `sub/iat/nbf/exp/iss/aud/typ/jti`; decode rejects wrong audience, wrong issuer, wrong `typ`; `/api/auth/me` rejects a foreign-audience token
  - document metadata persists and serializes; verification records `verified_content_hash` (explicit or defaulted from `content_hash`)
- **Updated**: every existing test that issues PATCH or transition now threads `expected_version` via small helpers.

## Known limitations after Phase 1

- **No Alembic bundled**. Schema evolution against an existing Postgres database currently requires hand-written `ALTER TABLE`s (see `docs/migrations.md`). Adding Alembic cleanly is a natural next pass.
- **Evaluation-driven risk recalc during a blocked transition still persists new `risk_score` / `risk_band` on the record row but does not bump `version`**. This is a deliberate UX/concurrency tradeoff (risk is a system side effect); if the product wants risk changes to conflict against concurrent human edits, version would need to be bumped in `evaluation_service.evaluate_and_persist` too.
- **Audit chain is organization-scoped and append-from-now-on**. Existing audit rows written before Phase 1 were backfilled with an `entry_hash` equal to the hash of their current fields (since the column is `NOT NULL`) — but in the current in-memory-per-test setup this is moot. In a live Postgres migration you would want the migration to compute those hashes for historical rows, or accept that trust begins at the first post-migration row.
- **No token revocation / jti tracking**. `jti` is issued but not persisted or checked. A small `revoked_jtis` table is a natural next step if revocation becomes a requirement.
- **No refresh-token flow**. Explicitly out of scope for Phase 1.
- **`verified_content_hash` is set server-side if the reviewer does not supply one** — this is a convenience for demos; a real deployment would have the verify path re-hash the retrieved blob rather than trust the ingest-time value.
- **Frontend `records.update` helper is not yet defined**. Currently only the transition path uses `expected_version`; if/when the UI gains inline-edit, the helper pattern is already proved out in tests.
