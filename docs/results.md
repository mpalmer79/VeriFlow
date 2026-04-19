Phase 5 committed (`4fe484e`) and pushed. **151 backend tests passing**, frontend build succeeds, baseline migration unchanged, **no new migration required**.

## Summary

**A. Inline evidence preview UX.** The record detail page now shows a **Preview** button for upload-backed documents whose `mime_type` is PDF / PNG / JPEG. Clicking it fetches the blob via `documents.fetchContent({ disposition: "inline" })`, creates a local object URL, and renders it inside a lightweight modal (`<img>` for images, `<iframe>` for PDFs, download-only fallback for anything else). Escape closes the modal; object URLs are revoked on close/unmount. Metadata-only documents never show the button.

**B. Range support.** `evidence_storage.iter_stored_chunks` now takes inclusive `start` / `end` byte offsets. The content route parses a single `Range: bytes=start-end` (including suffix `bytes=-N` and open-ended `bytes=N-`) and returns **206** with correct `Content-Range` / `Content-Length`. Invalid or multi-range requests return a clean **416** with `Content-Range: */total`. Absence of a Range header keeps the original full-stream behavior.

**C. Content header hardening.** Every content response sets `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-store, max-age=0`, `Referrer-Policy: no-referrer`, and `Accept-Ranges: bytes`. A new `?disposition=attachment|inline` query param (default `attachment`) is honored only when `mime_type` is in the `PREVIEWABLE_CONTENT_TYPES` set; anything else silently downgrades to `attachment` so the UI can't trick the route into inlining arbitrary content.

**D. Record-scoped evidence summary.** `document_service.evidence_summary(record)` + `GET /api/records/{id}/evidence-summary` returns: `documents_total`, `upload_backed`, `metadata_only`, `verified`, `rejected`, `integrity_checkable`, `missing_content`, `stored_bytes` (measured from actual files on disk). The record detail page renders a compact four-cell strip above the upload form.

**E. Storage-inventory admin endpoint.** `evidence_storage.iter_managed_files` walks the managed root non-recursively. `GET /api/audit/storage-inventory` returns an **org-scoped** dry-run report: managed files on disk + total bytes, files referenced by the caller's org, dangling references (DB row → missing file), orphan count (files on disk referenced nowhere). No file paths are ever surfaced — only counts and totals.

## Files modified
- `backend/app/api/routes/audit.py`
- `backend/app/api/routes/documents.py`
- `backend/app/api/routes/records.py`
- `backend/app/core/evidence_storage.py`
- `backend/app/schemas/document.py`
- `backend/app/services/document_service.py`
- `frontend/app/(app)/records/[id]/page.tsx`
- `frontend/lib/api.ts` · `frontend/lib/types.ts`

## Files added
- `backend/tests/test_phase5_hardening.py`

## Migration files
**No new migration required.** Baseline `0001_initial_schema.py` unchanged; all capability is routes / services / helpers / frontend.

## Tests added / updated
- **Added** `tests/test_phase5_hardening.py` (16 tests):
  - content headers: nosniff, no-store, accept-ranges, default-attachment
  - disposition: inline honored for PDF/PNG/JPEG; silently downgrades for non-previewable types; invalid value → 422
  - Range: partial `bytes=N-M`, open-ended `bytes=N-`, suffix `bytes=-N`; invalid / multi-range → 416 with `Content-Range: */total`; reassembled ranged content's SHA-256 matches the ingest hash
  - evidence summary: mixed upload/metadata/verified docs produce correct counts + byte totals; `missing_content` surfaces when backing bytes disappear; 404 for unknown record
  - storage inventory: referenced / orphan / dangling counts correct in an isolated storage root; endpoint requires auth
  - `iter_managed_files` ignores files outside the configured root

## Remaining limitations

- **Preview uses blob URLs, not direct URLs.** Because the content endpoint requires a Bearer token, `<img>` / `<iframe>` cannot load it directly; we fetch the whole blob first. Large PDFs will therefore not stream into a browser PDF viewer via Range — they're fully downloaded, then displayed. A future phase could switch to short-lived signed URL tokens for direct media loading.
- **Storage inventory is read-only.** No cleanup endpoint is exposed. Automated deletion of orphans is intentionally deferred; operators can identify orphans from the report and remove them out-of-band.
- **`iter_managed_files` is non-recursive.** Matches `store_stream`'s current flat layout; a future content-addressed storage scheme with subdirectories would need the iterator updated.
- **Evidence summary does not include per-type breakdowns.** It aggregates at the record level; a future pass could split by `DocumentType` if the UI needs it.
- **No server-side rate limiting on content or range requests.** Fine for local demo; production behind a load balancer/WAF should enforce request rates and maximum concurrent ranges per user.
- **Frontend preview modal has no keyboard trap.** Tabbing can escape the modal. Accessibility pass is deferred; for the current demo surface the Escape-to-close + click-outside-to-close behavior is sufficient.
- **No content CSP header added.** The existing FastAPI app doesn't emit a CSP; adding one would help lock down `<iframe>` rendering but touches the whole app's middleware layer. Out of scope for this content-endpoint-focused pass.
- **Audit chain verification and storage inventory are per-organization only.** Cross-org (deployment-wide) reporting would require a privileged role; role-based authorization isn't wired yet, so this was deliberately scoped.
- **Alembic is not invoked at app startup.** Still requires `alembic upgrade head` for production deployments (documented in `docs/migrations.md`).
