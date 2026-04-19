Phase 2 hardening committed (`81680ff`) and pushed. **99 backend tests passing**, frontend build succeeds, Alembic boots clean.

## Summary

**A. Real file hashing at ingest.** New `core/evidence_storage.py` owns local-disk persistence; files are written under `EVIDENCE_STORAGE_DIR` with server-generated UUID names, and `storage_uri` is persisted as `file:<absolute-path>`. New multipart route `POST /api/records/{id}/documents/upload` reads the uploaded bytes, computes SHA-256 and byte count from the payload itself, sanitizes client filenames, and persists through `document_service.upload_file_document`. The legacy JSON `POST /api/records/{id}/documents` is now explicitly a metadata-only registration (`register_document_metadata`) and cannot claim a server-owned storage URI.

**B. Real verification-time re-hash.** `verify_document` no longer accepts nor defaults `verified_content_hash`. It reads the stored bytes, recomputes SHA-256, writes `verified_content_hash` only when it matches the persisted `content_hash`. On mismatch the document is rejected with a diagnostic `rejection_reason`, a `document.integrity_failed` audit event is emitted, and the route returns 409. Missing stored content or missing ingest hash → 400 (`DocumentContentMissing`).

**C. Integrity-check capability.** `POST /api/documents/{id}/integrity-check` returns a structured `IntegrityCheckResponse` (`has_stored_content`, `expected_content_hash`, `actual_content_hash`, `is_match`, `checked_at`, `message`). Read-only — never mutates the document row.

**D. Phase 1 concurrency-semantics leak fixed.** `evaluation_service.evaluate_and_persist` gains `apply_to_record: bool = True`. `workflow_service.transition_record` calls it with `apply_to_record=False` so a **blocked** transition no longer mutates `record.risk_score` / `risk_band`. On success, the workflow service applies stage + risk + version together as a single atomic mutation and emits `record.risk_recalculated`; on block, nothing on the record row changes. The caller still gets the decision payload with the computed risk for UI display.

**E. Alembic bootstrap.** `backend/alembic.ini`, `backend/migrations/env.py` (wires `Base.metadata` and resolves `DATABASE_URL` from settings), `script.py.mako`, and `versions/0001_initial_schema.py` (a baseline that calls `Base.metadata.create_all` / `drop_all`). `alembic==1.13.3` added to requirements. Verified with `alembic upgrade head` / `alembic current`. Future schema changes go on top of this baseline as proper incremental migrations; tests keep using `create_all` for speed and share the same metadata.

**F. Config.** New settings `evidence_storage_dir` (default `./evidence`) and `max_upload_bytes` (default 25 MB). `.env.example` updated. `.gitignore` now ignores `backend/evidence/` and `evidence/`. The pytest conftest pins storage to a per-session tempdir and cleans blobs between tests.

## Exact files modified
- `backend/.env.example`
- `backend/app/api/routes/documents.py`
- `backend/app/api/routes/records.py`
- `backend/app/core/config.py`
- `backend/app/schemas/document.py`
- `backend/app/services/document_service.py`
- `backend/app/services/evaluation_service.py`
- `backend/app/services/workflow_service.py`
- `backend/requirements.txt`
- `backend/tests/conftest.py`
- `backend/tests/test_documents.py`
- `backend/tests/test_hardening.py`
- `backend/tests/test_phase1_hardening.py`
- `docs/migrations.md`
- `.gitignore`

## Exact files added
- `backend/alembic.ini`
- `backend/app/core/evidence_storage.py`
- `backend/migrations/env.py`
- `backend/migrations/script.py.mako`
- `backend/migrations/versions/0001_initial_schema.py`
- `backend/migrations/versions/.gitkeep`
- `backend/tests/test_phase2_hardening.py`

## Migration files added
- `backend/migrations/versions/0001_initial_schema.py` — honest baseline that applies `Base.metadata.create_all` against the bound engine. All Phase 0–2 schema (including Phase 1 additive columns) is included in this baseline.

## Tests added / updated
- **Added** `tests/test_phase2_hardening.py` (17 tests):
  - ingest computes SHA-256 and `size_bytes` from bytes; persists filename/mime; rejects empty and oversize payloads; sanitizes `../../etc/passwd` and keeps storage inside the configured root
  - verification recomputes from stored bytes and succeeds on untouched content; fails and re-rejects on tampering; fails cleanly on missing stored bytes; fails for metadata-only registrations
  - integrity-check returns match / mismatch / missing-content and never mutates the row
  - blocked transitions do not mutate `risk_score` / `risk_band` / `version`; successful transitions apply stage + risk + version atomically
  - Alembic env and baseline migration load cleanly against the app's metadata
- **Updated**: `test_documents.py`, `test_hardening.py`, and `test_phase1_hardening.py` to use the multipart upload path so their verify flows exercise real bytes. Rewrote `test_verification_records_verified_content_hash` to assert the server-recomputed hash rather than the old client-attested default.

**Full suite: 99 passed.** Frontend build still succeeds.

## Known limitations after Phase 2
- **Frontend does not yet expose the upload path.** The existing detail page's Verify/Reject buttons work for documents registered via the legacy JSON path only when content is absent — verify now fails cleanly with a 400 for those rows. Wiring a real drag-and-drop upload to `POST /documents/upload` and calling `/integrity-check` from the UI is the natural Phase-3 frontend pass.
- **Evidence storage is local-only.** No S3/GCS. `storage_uri` has a scheme-based contract so a future storage backend can live behind the same interface without schema changes.
- **No anti-virus / content-type enforcement.** `mime_type` comes from the client's multipart header; we persist it but do not validate the bytes match. A later hardening step could add magic-byte sniffing.
- **Seed documents remain metadata-only.** Demo records created by `seed_data.py` still use direct `Document()` instantiation without real bytes; their `verify` path would now fail. That's intentional — the seed represents pre-integrity-era data — but a future pass could rewrite seed to drop real bytes into the evidence dir.
- **No quota or retention policy.** `max_upload_bytes` guards a single payload; there's no aggregate per-record or per-org quota and nothing purges stored bytes when the document row is deleted (FK cascades remove the row but orphan the file). A future pass would add a storage cleanup hook.
- **`verified_content_hash` semantics are "bytes on disk match ingest hash"**, not "bytes on disk match what a second verifier scanned externally". If a human reviewer is supposed to attest against an out-of-band source of truth, a separate workflow is needed; in this phase, we deliberately refuse client-supplied verified hashes.
- **Audit chain for `document.integrity_failed`** uses an ad-hoc payload rather than going through `audit_payloads.py`. Routing it through a canonical builder would be a trivial Phase-3 cleanup.
- **Alembic is not invoked at app startup.** `Base.metadata.create_all` still runs in `seed_data.run()` for local demo convenience. Production deployments should run `alembic upgrade head` before starting the app; this is documented in `docs/migrations.md`.
