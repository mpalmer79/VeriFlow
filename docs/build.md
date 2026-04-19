You are acting as a staff-level full-stack engineer performing Phase 4 hardening on an existing FastAPI + SQLAlchemy + PostgreSQL + Next.js project named VeriFlow.

Phase 1 through Phase 3 already landed. The repo now has:
- optimistic concurrency on records
- tamper-evident audit chaining
- stronger JWT claims/validation
- real evidence storage on local disk
- multipart document upload
- verification-time re-hash
- document integrity-check endpoint
- blocked-transition risk mutation fix
- Alembic bootstrap with a baseline migration
- frontend upload flow
- frontend integrity-check visibility
- evidence deletion with local file cleanup
- stronger file type validation at ingest

Your job in Phase 4 is to improve operational robustness, content access, and storage lifecycle without breaking the current architecture.

This is not a rewrite. This is a focused hardening and product-completion pass.

==================================================
OBJECTIVE
==================================================

Implement the following Phase 4 upgrades:

1. Secure content delivery endpoint for stored evidence
2. Streaming upload hashing and storage to avoid whole-file memory reads
3. Record-level and cascade-safe evidence cleanup strategy
4. Audit payload normalization cleanup
5. Optional lightweight admin/debug tooling for audit and storage integrity
6. Tests covering the new behavior
7. Explicit incremental Alembic migration only if schema changes are required

Do not stop at analysis. Inspect the repo, reconcile to actual file paths, and implement completely.

==================================================
NON-NEGOTIABLE EXECUTION RULES
==================================================

1. Inspect the repo first.
   - Read the current backend and frontend structure fully.
   - Identify the actual files for:
     - document routes
     - record routes
     - evidence storage helper
     - document service
     - audit payload builders
     - config/settings
     - migrations
     - frontend API helpers/types
     - current record detail page
     - tests
   - Confirm the current upload, verify, integrity-check, and delete flows before changing them.

2. Preserve the current architecture.
   - Keep FastAPI + SQLAlchemy + local evidence storage
   - Keep Next.js app structure as-is
   - Do not introduce cloud storage
   - Do not introduce background workers
   - Do not redesign auth architecture
   - Do not redesign the frontend

3. Prefer modifying existing files.
   - Avoid duplicate components and helpers
   - Reuse existing patterns for API calls, UI state, error handling, and audit events

4. Keep security and correctness ahead of convenience.
   - Do not expose raw filesystem paths
   - Do not stream files without access control
   - Do not allow file deletion outside the managed storage root
   - Do not weaken existing integrity semantics

5. No fake UX.
   - Do not expose a “download” or “view” action unless the backend route actually serves stored content securely
   - Do not show content actions for metadata-only documents as if they were upload-backed evidence

6. No half-finished migration work.
   - If schema changes are needed, add a proper incremental Alembic revision
   - Do not modify the baseline migration
   - Do not break migration history

7. Minimal comments.
   - No AI-style comments
   - No tutorial comments
   - Only concise human comments where needed

8. At the end, provide:
   - concise summary
   - exact files changed
   - exact files added
   - migration files added
   - tests added/updated
   - known limitations remaining

==================================================
I. ALEMBIC DISCIPLINE (MANDATORY)
==================================================

This project uses Alembic with a baseline migration:

    0001_initial_schema.py

This file is LOCKED.

You MUST NOT:
- modify 0001_initial_schema.py
- regenerate or overwrite the baseline
- collapse new schema changes into the baseline
- create fake or redundant migrations

All schema evolution must be incremental.

----------------------------------------
SCHEMA CHANGE DETECTION
----------------------------------------

Before implementing any change, determine:

"Does this change the database schema?"

Schema changes include:
- adding/removing columns
- changing nullability
- changing defaults
- adding/removing indexes
- adding/removing constraints
- adding/removing tables

If YES:
→ create a NEW migration revision

If NO:
→ DO NOT create a migration

----------------------------------------
INCREMENTAL MIGRATIONS ONLY
----------------------------------------

If a schema change is required:

1. Create a new migration file:
   backend/migrations/versions/

2. Use clear naming:
   - 0002_add_<thing>
   - 0003_alter_<thing>
   - 0004_create_<thing>

3. Implement BOTH:
   - upgrade()
   - downgrade()

4. Do not touch the baseline migration.

----------------------------------------
MODEL ↔ MIGRATION CONSISTENCY
----------------------------------------

Every schema change must be reflected in BOTH:
- SQLAlchemy model
- Alembic migration

These must agree on:
- column type
- nullability
- defaults

----------------------------------------
SAFE EVOLUTION
----------------------------------------

For changes affecting existing rows:

Prefer:
1. Add column nullable
2. Backfill if needed
3. Later enforce constraints

Avoid destructive one-step changes.

----------------------------------------
NO BASELINE MODIFICATION
----------------------------------------

You MUST treat:

    0001_initial_schema.py

as immutable.

If you think it needs to change:
→ you are wrong
→ create a new migration

----------------------------------------
TEST COMPATIBILITY
----------------------------------------

Tests may still use metadata.create_all.

You MUST:
- not break test setup
- keep models as schema source of truth
- ensure Alembic works for real DB usage

----------------------------------------
OUTPUT REQUIREMENT
----------------------------------------

If ANY schema change is made, include:
- migration filename
- what it changes
- confirmation baseline not modified

If NO schema change:
→ explicitly say: "No new migration required"

==================================================
PHASE 4 REQUIREMENTS
==================================================

----------------------------------------
A. SECURE CONTENT DELIVERY ENDPOINT
----------------------------------------

Goal:
Add a secure way to retrieve stored evidence content for upload-backed documents.

Required behavior:
1. Add a backend endpoint to stream or serve stored content for a document.
2. Access control must match the project's existing organization/user authorization model.
3. The route must only work for documents with stored local content.
4. Metadata-only documents must return a coherent failure response.
5. The route must not expose internal filesystem paths in the response.
6. Content delivery should set appropriate response headers:
   - content type
   - content disposition if appropriate
   - safe filename when possible

Preferred route style:
- GET /api/documents/{id}/content

Requirements:
- verify the document belongs to the caller’s organization
- verify stored content exists
- stream or return file content without loading arbitrarily large content into memory if practical
- use the server-known content type, not blind client trust

Do not:
- expose raw `storage_uri`
- serve files outside the configured storage root
- allow content access for metadata-only documents

If the current UI supports it cleanly:
- add a “View” or “Download” action only for upload-backed evidence

----------------------------------------
B. STREAMING UPLOAD HASHING / STORAGE
----------------------------------------

Goal:
Stop reading the entire upload into memory before hashing and writing.

Current known limitation:
- upload path reads `await file.read()` into memory

Required behavior:
1. Refactor ingest so hashing and file persistence are performed incrementally in chunks.
2. Preserve current behavior:
   - compute SHA-256 from exact stored bytes
   - compute size_bytes from actual bytes
   - store under server-controlled managed path
3. Respect `max_upload_bytes` while streaming.
4. If payload exceeds limit:
   - abort safely
   - clean up partial file
   - return coherent error response

Preferred design:
- centralize chunked hashing/writing in `evidence_storage.py`
- document service remains orchestration layer
- route layer stays thin

Do not:
- regress file type validation
- keep dual code paths unless necessary
- leave partial files orphaned on failure

----------------------------------------
C. RECORD-LEVEL / CASCADE-SAFE EVIDENCE CLEANUP
----------------------------------------

Goal:
Close the remaining storage lifecycle gap around orphaned files.

Current known limitation:
- when records are cascade-deleted, DB rows disappear but local files may remain orphaned

You must inspect the current deletion behavior first.

Required behavior:
Implement one coherent strategy that fits the existing architecture:

Preferred approach:
1. Add a record-level delete path that explicitly deletes associated managed evidence files before deleting the record
2. If a record delete route already exists, extend it
3. If not, add the smallest correct delete path consistent with current architecture

Requirements:
- gather associated documents
- delete managed local files safely
- then delete record and related rows
- emit appropriate audit events
- tolerate already-missing files where correct
- never delete outside managed storage root

Alternative if record deletion is not yet part of product surface:
- add a dedicated cleanup helper and tests proving cascade orphan prevention strategy
- document the operational deletion path clearly

Do not:
- rely on DB cascade alone for file cleanup
- delete arbitrary file URIs
- silently ignore unsafe storage paths

----------------------------------------
D. AUDIT PAYLOAD NORMALIZATION
----------------------------------------

Goal:
Clean up remaining ad-hoc audit payloads so audit events are consistently shaped.

Required behavior:
1. Inspect current `audit_payloads.py` usage
2. Find remaining ad-hoc payload construction in services/routes
3. Normalize those into canonical payload builders
4. At minimum, route the known ad-hoc integrity-related payloads through the central builder module

Requirements:
- preserve current event semantics
- improve consistency of payload shape
- avoid changing unrelated audit history patterns

Do not:
- redesign the entire audit system
- break existing tests for audit events

----------------------------------------
E. OPTIONAL ADMIN / DEBUG TOOLING
----------------------------------------

Goal:
Add one small operational tool that improves trust and diagnosability.

Pick the best fit after inspecting current repo patterns.

Good options:
1. Audit chain verification endpoint/service for a record or organization scope
2. Storage consistency checker for a record
3. Combined record evidence + audit integrity debug summary

Preferred characteristics:
- narrow
- read-only
- useful
- secure
- consistent with existing auth patterns

Do not:
- build a giant admin panel
- dump internal paths directly to end users
- expose unsafe filesystem details

----------------------------------------
F. FRONTEND/API CONTRACT CLEANUP
----------------------------------------

Goal:
Reflect new content-delivery and cleanup capabilities in the UI without misleading users.

Required behavior:
1. Update frontend types and API helpers as needed
2. Add UI affordance for upload-backed documents only:
   - View / Download content if content endpoint is added
3. Preserve explicit separation between:
   - metadata-only docs
   - upload-backed evidence
4. Ensure delete flow updates UI state correctly
5. Ensure integrity summary / content actions do not appear where they cannot work

Do not:
- expose actions the backend cannot fulfill
- infer capability from brittle heuristics if backend can tell you directly

If backend needs to expose a derived capability field for UI clarity, do so without adding unnecessary persisted schema.

----------------------------------------
G. FILE VALIDATION HARDENING (LIGHTWEIGHT ONLY)
----------------------------------------

Goal:
Strengthen validation without overbuilding.

Current known limitation:
- magic-byte detection is header-oriented and intentionally lightweight

Required behavior:
1. Review current validation helper
2. Improve safety where feasible without adding heavy infrastructure
3. At minimum:
   - keep current allowlist strict
   - ensure server-detected type always wins
   - make failure responses coherent
4. If practical and low-risk:
   - improve JPEG/PNG/PDF signature handling slightly
   - centralize allowlist and detection behavior more clearly

Do not:
- add antivirus
- add heavyweight parsing libraries unless absolutely necessary and justified
- broaden supported file types casually

If no meaningful safe improvement is needed, keep the current approach and state that clearly.

----------------------------------------
H. TESTING
----------------------------------------

Extend the current test suite.

At minimum add/update tests for:
1. content endpoint returns data only for upload-backed docs
2. content endpoint rejects metadata-only docs
3. content endpoint respects org access boundaries
4. streaming upload path computes correct hash and size
5. oversize streaming upload aborts and cleans partial files
6. record-level cleanup removes managed files safely
7. cleanup does not delete outside storage root
8. normalized audit payload builders are used for known ad-hoc cases
9. any new admin/debug route behaves correctly

Use existing test patterns and fixtures.
Do not create a new framework.

==================================================
IMPLEMENTATION DISCOVERY STEPS
==================================================

Before editing:
1. Read current backend files for:
   - document routes
   - record routes
   - evidence storage helper
   - document service
   - audit payloads
   - config
   - migrations
2. Read current frontend files for:
   - records detail page
   - API client
   - shared types
3. Determine whether a record delete route already exists.
4. Determine whether document content serving already partially exists.
5. Determine current testing patterns.

Then implement the changes.

==================================================
ACCEPTANCE CRITERIA
==================================================

- upload-backed evidence can be retrieved securely through a real content endpoint
- metadata-only documents do not expose invalid content actions
- upload ingest no longer requires loading whole file into memory first
- partial uploads are cleaned up on failure
- evidence cleanup strategy for record/file lifecycle is materially improved
- remaining ad-hoc audit payloads are normalized
- frontend reflects new content capabilities correctly
- tests cover the critical new behavior
- imports are clean
- no obvious runtime mismatch remains

==================================================
OUTPUT FORMAT
==================================================

Provide:

1. Summary
2. Files modified
3. Files added
4. Migration files
5. Tests updated/added
6. Remaining limitations

Now begin by inspecting the repository and identifying exact files to modify.
