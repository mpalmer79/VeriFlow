Phase 3 hardening committed (`b62d5f0`) and pushed. **118 backend tests passing**, frontend build succeeds, and **no new migration was required** — `has_stored_content` is derived from `storage_uri` at read time, not a new column.

## Summary

**A. Frontend: real document upload.** Record detail page gains a multipart upload form that POSTs to `/api/records/{id}/documents/upload`. A new `documents.upload` helper in `lib/api.ts` builds `FormData`, injects the bearer token, and shares `ApiError` handling with the rest of the client.

**B. Frontend: integrity check.** Per-document "Integrity check" button hits `/api/documents/{id}/integrity-check`, caches the result in local state, and displays match / mismatch / missing-content inline without reloading. Verify and Integrity-check buttons are disabled for metadata-only documents and show an explicit "Metadata only" chip so the UI never offers an action that can only fail.

**C. Evidence deletion.** New `DELETE /api/documents/{id}` with service-level `delete_document`: drops the row, runs `evidence_storage.delete_local_object` (which re-validates the path is inside the configured root), tolerates already-missing files, and emits a canonical `document.deleted` audit payload. Frontend adds a "Delete" button with a confirm prompt and clears any cached integrity result for the removed doc.

**D. File validation at ingest.** `evidence_storage.detect_content_type` sniffs magic bytes for PDF / PNG / JPEG and falls back to an allowlisted client-mime. Detected type always wins over a spoofed client header — a PNG payload sent as `application/pdf` is persisted as `image/png`. Unsupported content returns 415; empty payloads still return 400 (checked first).

**E. API contract cleanup.** `DocumentRead` now exposes `has_stored_content: bool` derived from an ORM `@property` (`is_local_uri(storage_uri)`) — no DB column, no migration. `storage_uri` is no longer in the response; server paths stay server-internal.

**F. Admin/debug tool.** Read-only `GET /api/records/{id}/integrity-summary` runs the integrity check against every document on the record and returns the structured results.

## Files modified
- `backend/app/api/routes/documents.py` · `backend/app/api/routes/records.py`
- `backend/app/core/evidence_storage.py`
- `backend/app/models/document.py`
- `backend/app/schemas/document.py`
- `backend/app/services/audit_payloads.py` · `backend/app/services/document_service.py`
- `backend/tests/test_documents.py` · `test_hardening.py` · `test_phase1_hardening.py` · `test_phase2_hardening.py` (updated to use real magic bytes + fetch storage paths via the ORM)
- `frontend/app/(app)/records/[id]/page.tsx`
- `frontend/lib/api.ts` · `frontend/lib/types.ts`

## Files added
- `backend/tests/test_phase3_hardening.py`

## Migration files added
**No new migration required.** `has_stored_content` is a derived attribute, not a persisted column; no other schema changes were made this phase. The baseline `0001_initial_schema.py` remains untouched.

## Tests added / updated
- **Added** `tests/test_phase3_hardening.py` (19 tests):
  - upload accepts PDF / PNG / JPEG; rejects unsupported types with 415
  - magic-byte detection overrides spoofed client mime
  - metadata registration has `has_stored_content=False`; real upload `True`
  - responses never expose `storage_uri`
  - DELETE removes DB row + file, tolerates missing files, works on metadata-only rows, emits an audit event, 404s on unknown ids
  - per-record integrity summary returns structured per-document results including mismatch when bytes are tampered
  - `detect_content_type` contract (magic-over-client, allowlisted fallback, rejection)
- **Updated**: existing upload-based tests now send real magic-byte payloads; `test_phase2_hardening` tests fetch storage paths via the ORM because responses no longer carry `storage_uri`.

## Remaining limitations after Phase 3

- **No content delivery endpoint.** There's no way to download the stored bytes from the UI yet. Adding a streamed `GET /api/documents/{id}/content` with appropriate access control is the natural Phase 4 add.
- **Content-type allowlist is tight (PDF/PNG/JPEG).** Expanding to TIFF, HEIC, DOCX, etc. is a policy change — add magic signatures in `_MAGIC_SIGNATURES` and an entry in `ALLOWED_CONTENT_TYPES`.
- **No aggregate / quota / retention.** `max_upload_bytes` guards a single payload; there's no per-record or per-org quota, and no sweeper for files orphaned when a record is cascade-deleted.
- **Multipart streaming.** The route reads the whole payload with `await file.read()` into memory before hashing. Fine up to `max_upload_bytes`, but a streaming hasher would scale further.
- **Magic-byte detection is header-only.** A determined attacker could prefix a PNG header onto arbitrary bytes and the server would accept it. Stronger validation would require full-format parsing — out of scope for this pass.
- **No AV / secret scanning of uploads.** Worth adding before hosting.
- **Frontend upload form does not validate client-side magic bytes**; it relies entirely on the server's 415 response. A future polish can peek at the first few bytes in the browser before uploading.
- **Audit chain's `document.integrity_failed` payload** (from Phase 2) is still ad-hoc rather than routed through `audit_payloads.py`. Untouched here; small future cleanup.
- **Alembic is not invoked at app startup.** Production deployments must run `alembic upgrade head` before starting the app; documented in `docs/migrations.md`.
