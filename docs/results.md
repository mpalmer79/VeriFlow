Phase 4 committed (`c5f4a66`) and pushed. **135 backend tests passing**, frontend build succeeds, baseline migration unchanged, **no new migration required**.

## Summary

**A. Secure content delivery.** `GET /api/documents/{id}/content` backed by `document_service.resolve_content_for_download`. Org-scoped, rejects metadata-only rows, only serves paths that `evidence_storage.resolve_local_path` has verified live inside the configured evidence root. The route streams 64 KB chunks through a new `evidence_storage.iter_stored_chunks` async generator; `Content-Disposition` uses a sanitized filename derived from the persisted `original_filename`, and `Content-Type` comes from the server-persisted `mime_type` — never from the caller.

**B. Streaming upload ingest.** `evidence_storage.store_stream` consumes an async reader incrementally — peeks 32 bytes, runs `detect_content_type`, then writes/hashes chunks under a temp file that is unlinked on **any** exception (oversize, unsupported type, I/O error, cancellation). `document_service.upload_file_stream` is the new entry point for multipart routes; `upload_file_document` (bytes variant) remains for in-memory callers and tests. The multipart route no longer reads `await file.read()` into memory.

**C. Record-level cleanup.** New `DELETE /api/records/{id}?expected_version=N` backed by `record_service.delete_record`. Deletes managed files first (via `evidence_storage.delete_local_object`, which refuses paths outside the storage root), emits a canonical `record.deleted` audit event with `documents_removed` and `stored_files_removed`, and deletes the record (FK cascade handles rows). Respects the Phase 1 optimistic concurrency pattern — 409 on stale `expected_version`.

**D. Audit payload normalization.** New `audit_payloads.document_integrity_failed` canonical builder; `document_service.verify_document` now routes the integrity-mismatch event through it. No other ad-hoc payloads remain.

**E. Admin/debug tooling.** `audit_service.verify_chain` walks every audit row in an organization scope, recomputes each `entry_hash` from its stored fields, and reports broken entries / broken links. New `GET /api/audit/verify` returns `{ organization_id, checked, ok, broken_entries, broken_links }`. Read-only; never mutates audit rows.

**F. Frontend wiring.** `documents.fetchContent` / `documents.contentUrl` helpers in `lib/api.ts`. The record detail page now shows a **Download** button per upload-backed document (disabled for metadata-only) that triggers a browser-native blob download with the server-sanitized filename. `records.remove` helper added for future use.

**G. File validation.** Kept as-is — current PDF/PNG/JPEG allowlist with server-wins magic-byte detection remains correct. Streaming preserves the same validation because `detect_content_type` runs on the peeked head bytes before any file is committed.

## Files modified
- `backend/app/api/routes/documents.py`
- `backend/app/api/routes/records.py`
- `backend/app/core/evidence_storage.py`
- `backend/app/main.py`
- `backend/app/services/audit_payloads.py` · `audit_service.py` · `document_service.py` · `record_service.py`
- `backend/tests/test_phase2_hardening.py` (oversize test updated to exercise the streaming size limit)
- `frontend/app/(app)/records/[id]/page.tsx`
- `frontend/lib/api.ts`

## Files added
- `backend/app/api/routes/audit.py`
- `backend/tests/test_phase4_hardening.py`

## Migration files
**No new migration required.** The baseline `0001_initial_schema.py` is unchanged. All Phase 4 capability is routes / services / storage behavior — zero schema changes.

## Tests added / updated
- **Added** `tests/test_phase4_hardening.py` (17 tests):
  - content endpoint: upload-backed doc served with correct type + disposition + exact-byte round-trip; metadata-only rejected; unauthenticated 401; cross-org 403/404; hostile filename sanitized in `Content-Disposition`
  - streaming upload: large-payload integrity preserved; oversize aborts and leaves no orphan blob (isolated tmp root); empty/unsupported still return 400/415
  - record delete: removes record + cascaded documents + managed files; respects storage root (rogue outside-root file is left alone); stale version → 409; audit event carries canonical counts
  - `document.integrity_failed` uses the canonical builder
  - audit chain verify: `ok=true` for clean chain, flags a tampered row as `broken_entries`, requires auth
- **Updated** `test_phase2_hardening::test_ingest_rejects_overlong_payload` to send bytes that pass content-type detection so the streaming path's size limit is actually the check being exercised.

## Remaining limitations

- **Download UX is basic.** The frontend triggers a blob download; there is no inline preview/viewer. A future pass could add image/PDF preview using the same endpoint.
- **No content-serving range requests.** Large PDFs will download in full rather than stream to a browser's PDF viewer via `Range`. Worth adding if the product grows toward viewer-style UX.
- **Record deletion is not in the UI.** The backend route is complete and tested; the Phase 3 document-delete button already exists, but there's no "Delete record" button yet. Adding one is a small follow-up but was intentionally skipped to keep this phase focused.
- **Audit chain verify is per-organization only.** For a multi-tenant deployment with massive audit logs this would want pagination / scoped checks; for the current scale the single-pass design is fine.
- **Streaming hash is still synchronous I/O.** `out.write()` runs on the event-loop thread; fine for 25 MB payloads but a Starlette `run_in_threadpool` wrapper would be the next step for multi-megabyte high-concurrency deployments.
- **No at-rest encryption.** Stored blobs live under `EVIDENCE_STORAGE_DIR` in the clear. Fine for local demo; production deployments should put that directory on an encrypted volume or add application-level envelope encryption.
- **Alembic is still manual.** `alembic upgrade head` is documented in `docs/migrations.md` but not invoked automatically at app startup; production deployments must run it explicitly.
- **Audit chain verification is read-only.** There is no "repair" / re-chain flow — if a tampered row is detected, the correct response is forensic investigation, not automated re-hashing.
