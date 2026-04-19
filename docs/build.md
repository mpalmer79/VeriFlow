You are acting as a staff-level backend engineer performing Phase 2 hardening on an existing FastAPI + SQLAlchemy + PostgreSQL project named VeriFlow.

Phase 1 already landed. It introduced:
- optimistic concurrency on records
- tamper-evident audit chaining
- stronger document metadata
- stronger JWT claims and validation

Your job in Phase 2 is to upgrade the evidence pipeline, integrity model, and migration foundation without destabilizing the current architecture.

This is not a rewrite. This is a targeted hardening and production-readiness pass.

==================================================
OBJECTIVE
==================================================

Implement the following Phase 2 upgrades:

1. Real file hashing at ingest
2. Real verification-time re-hash against stored content
3. Integrity-check capability for documents
4. Alembic bootstrap and initial migration support
5. Fix the Phase 1 concurrency semantics leak around risk persistence during blocked transitions
6. Add or update tests to prove correctness

Do not stop at analysis. Inspect the repository, reconcile with what actually exists, and perform the implementation fully.

==================================================
NON-NEGOTIABLE EXECUTION RULES
==================================================

1. Inspect the repo first.
   - Read the current backend structure fully.
   - Identify actual file paths for:
     - config
     - models
     - schemas
     - services
     - repositories
     - routes
     - db/session/base
     - tests
     - startup/bootstrap
     - existing docs
   - Confirm how documents are currently created, stored, verified, and exposed.

2. Preserve current architecture.
   - Keep the modular monolith.
   - Do not introduce microservices.
   - Do not add background jobs, queues, Redis, Celery, S3 SDK integration, or unrelated infra unless already present.
   - Do not replace auth architecture.
   - Do not redesign the frontend beyond what is required for API alignment.

3. Prefer modifying existing files.
   - Add files only when needed.
   - Avoid duplicating service logic.

4. Keep implementation consistent across layers.
   - model
   - schema
   - service
   - route
   - test
   - migration

5. No fake integrity.
   - Do not claim a file is verified unless the system actually recomputes its hash from stored bytes or from a deterministic local storage source.
   - Do not continue trusting ingest metadata as if it were proof.

6. No half-configured migration system.
   - If Alembic is added, it must be complete and usable.
   - If the repo already has Alembic, use it properly.
   - Do not leave broken env.py, script.py.mako, or config.

7. Minimal comments.
   - No AI-style comments
   - No tutorial comments
   - Only concise human comments where needed

8. At the end, provide:
   - concise summary
   - exact files changed
   - exact files added
   - migration files added
   - test files added/updated
   - known limitations remaining

==================================================
PHASE 2 REQUIREMENTS
==================================================

----------------------------------------
A. REAL FILE HASHING AT INGEST
----------------------------------------

Goal:
When a document is ingested or uploaded, compute a real SHA-256 hash from actual content and persist it as content_hash.

You must first inspect how the project currently handles documents.

Possible current states:
- metadata-only document registration
- local file path or storage_uri registration
- actual multipart upload route
- stubbed demo flow

Your implementation must adapt to the current repo.

Required behavior:
1. If the repo already supports actual file upload:
   - compute SHA-256 from uploaded bytes at ingest
   - persist original_filename, mime_type, size_bytes, and content_hash
   - store file content using the repo’s existing local storage approach or safest compatible local approach
   - do not add cloud storage in this phase

2. If the repo currently only supports storage_uri/metadata registration:
   - introduce the smallest correct local-file ingest flow that fits current architecture
   - do not break existing metadata registration unless intentionally deprecating it with safe compatibility
   - preserve current route behavior where feasible

3. Hashing requirements:
   - use SHA-256
   - hash the exact bytes stored
   - content_hash must always reflect the persisted content for newly ingested files

4. Storage requirements:
   - prefer a local evidence storage directory configured via settings
   - use deterministic server-controlled storage paths
   - do not trust client-provided storage_uri as the source of truth for new uploads
   - if legacy storage_uri path remains for backward compatibility, keep its semantics explicit

5. Validation:
   - reject empty file payloads
   - reject missing content when content hash is expected
   - set size_bytes from actual bytes, not from client metadata

Do not:
- add object storage/S3 integration
- fake hashing from filename or URI
- rely only on client-provided hashes

Preferred outcome:
- a real upload/ingest path exists
- content_hash is server-computed from stored bytes

----------------------------------------
B. REAL VERIFICATION-TIME RE-HASH
----------------------------------------

Goal:
Verification must prove that stored content still matches what was ingested.

Required behavior:
- verification path must retrieve the stored content
- recompute SHA-256 from the stored file bytes
- compare recomputed hash against persisted content_hash
- write verified_content_hash from the recomputed value
- mark verification success only if recomputed hash matches expected integrity conditions

Verification rules:
1. If stored content is missing:
   - verification must fail cleanly
   - do not mark verified

2. If recomputed hash does not match content_hash:
   - verification must fail
   - document should not be marked verified
   - ideally mark a clear error/rejection reason or integrity mismatch result consistent with current domain model

3. If recomputed hash matches:
   - verified_content_hash = recomputed hash
   - verified_at and verified_by fields updated as current model supports
   - status updated appropriately

4. If the current service supports reject flows:
   - preserve them
   - ensure integrity mismatch can route through that logic or equivalent clear failure semantics

Do not:
- default verified_content_hash from content_hash during verification
- trust client-supplied verified_content_hash as proof
- verify metadata without verifying actual file bytes

----------------------------------------
C. DOCUMENT INTEGRITY CHECK CAPABILITY
----------------------------------------

Goal:
Add a way to check whether a document still matches its stored ingest hash.

Implement one or both depending on repo fit:
- service function for integrity validation
- API endpoint for integrity check
- optionally a lightweight admin/debug route if current architecture supports it

Required behavior:
- fetch document by id
- resolve stored file path/content source
- recompute SHA-256
- compare against content_hash
- return a structured result

Suggested response shape:
- document_id
- has_stored_content
- expected_content_hash
- actual_content_hash
- is_match
- checked_at
- status/message

If current route conventions support nested resource routes, prefer something like:
- POST or GET /documents/{id}/integrity-check

Choose the method that best matches existing route style.

Do not expose raw file contents.

----------------------------------------
D. FIX PHASE 1 CONCURRENCY SEMANTICS LEAK
----------------------------------------

Goal:
Remove the inconsistency where blocked transitions mutate record risk fields without bumping record version.

This must be fixed now.

Preferred fix:
- blocked transition evaluation should not persist risk_score/risk_band changes to the record
- evaluation may still persist rule evaluation rows if that is part of current design
- transition should remain the state-changing operation
- record.version semantics should remain clean

Required behavior:
1. Inspect evaluation_service.evaluate_and_persist and related workflow logic
2. Separate:
   - decision computation
   - evaluation row persistence
   - record mutation
3. Ensure blocked transitions do not mutate record row state unless the design clearly and intentionally requires it
4. Keep version semantics clean:
   - no persisted record state mutation without appropriate version handling
5. If a successful transition still updates record risk fields, that is acceptable as part of the successful mutation path

If the repo structure makes the above difficult, use the next-cleanest approach:
- if evaluation must persist record risk changes, then version must increment there
But this is second choice.
Prefer keeping blocked evaluation non-mutating at the record-row level.

----------------------------------------
E. ALEMBIC BOOTSTRAP
----------------------------------------

Goal:
Move the project off ad hoc schema evolution.

You must inspect whether Alembic already exists.

Case 1: Alembic already exists
- use it properly
- generate or write migrations for Phase 1 and Phase 2 schema changes as needed
- ensure env.py is wired to current SQLAlchemy metadata

Case 2: Alembic does not exist
- initialize Alembic correctly
- configure alembic.ini
- configure env.py
- wire target_metadata to the actual declarative base metadata
- ensure migration scripts can run against the current database configuration
- create an initial migration or a baseline migration strategy appropriate to the repo

Requirements:
1. Alembic config must be complete
2. Migration folder structure must be valid
3. Metadata import must resolve
4. Existing schema changes from Phase 1 and Phase 2 must be represented appropriately

Migration strategy guidance:
- because the repo has already been using create_all for demo/test bootstrapping, choose a practical strategy
- if safest, create:
  - one baseline migration representing current schema for fresh environments
  - then one incremental migration for Phase 2 if needed
- or create one initial migration representing the current intended schema if the repo is still effectively greenfield/demo
Choose the strategy that best fits the repo state and explain it clearly.

Do not:
- leave both create_all startup bootstrapping and Alembic fighting each other in production semantics without clear separation
- break tests that rely on ephemeral schema setup unless necessary

Preferred behavior:
- keep tests lightweight if they currently use metadata.create_all
- but production/dev schema evolution should now clearly point to Alembic

----------------------------------------
F. CONFIG AND STORAGE SETTINGS
----------------------------------------

Add only the minimum necessary configuration for local evidence storage and integrity handling.

Expected settings if not already present:
- evidence_storage_dir
- possibly max upload size if repo already supports validation patterns
- any feature flag only if necessary

Requirements:
- safe defaults for local dev
- paths derived from settings, not hardcoded random locations
- directory creation should be handled safely where appropriate

Do not add a giant config explosion.

----------------------------------------
G. ROUTE AND SCHEMA ALIGNMENT
----------------------------------------

You must update the API contract to match the new real evidence flow.

Required:
- document create/upload schema and route must align with actual ingest design
- document read schema must expose integrity-relevant fields
- verification request schema must not imply trust in client-provided verified hash
- integrity-check response schema must be explicit and typed
- existing routes should remain compatible where reasonable

If multipart upload is introduced:
- use FastAPI UploadFile idiomatically
- keep route naming consistent with repo conventions
- ensure service layer receives bytes or stream safely

----------------------------------------
H. TESTING
----------------------------------------

If tests exist, extend them.

At minimum add/update tests for:
1. ingest computes content_hash from actual bytes
2. ingest stores correct size_bytes and filename metadata
3. verification re-hashes stored content and succeeds when bytes match
4. verification fails when stored content is altered or missing
5. integrity-check endpoint/service returns mismatch when bytes differ
6. blocked transition no longer mutates persisted record risk fields without intended semantics
7. Alembic config at least imports metadata cleanly if repo test style can support it

Use existing test style and fixtures.
Do not build an entirely new testing framework.

==================================================
IMPLEMENTATION DISCOVERY STEPS
==================================================

Before editing:
1. List backend structure and find actual files for models, schemas, services, routes, db config, and tests.
2. Read current:
   - document model
   - document schema
   - document service
   - document routes
   - evaluation service
   - workflow service
   - record model/schema if affected
   - config/settings
   - database/bootstrap logic
3. Determine whether current document flow is:
   - metadata only
   - multipart upload
   - local path storage
4. Determine whether Alembic exists.
5. Determine current tests and fixtures.

Then implement the changes.

==================================================
DESIGN GUIDANCE
==================================================

Use these design preferences unless the existing repo requires a close variation:

1. Content hashing
- hashlib.sha256(file_bytes).hexdigest()

2. Local evidence storage
- server-controlled directory from config
- subdirectories okay if needed
- deterministic filenameing preferred
- avoid path traversal risks
- do not use original filename as the storage filename directly unless sanitized and uniquely wrapped

3. Verification
- recompute hash from stored bytes
- compare to persisted content_hash
- verified_content_hash set only from recomputed bytes
- never trust client verified hash as proof

4. Integrity check
- read-only operation
- returns structured result
- does not change verification status unless explicitly designed to

5. Alembic
- use actual project metadata
- choose a clean baseline strategy
- keep it runnable

==================================================
ACCEPTANCE CRITERIA
==================================================

Do not consider the task complete unless all of the following are true:

- new ingested documents get content_hash from real bytes
- size_bytes comes from actual content
- verification re-hashes stored content
- verified_content_hash comes from recomputed bytes, not trust fallback
- integrity check capability exists
- blocked transition no longer causes hidden record-row mutation without coherent version semantics
- Alembic is fully bootstrapped or properly extended if already present
- routes, schemas, services, and models are internally consistent
- tests cover the critical paths
- imports are clean
- no obvious runtime mismatch remains

==================================================
OUTPUT FORMAT
==================================================

After implementation, provide:

1. Summary of what changed
2. Exact files modified
3. Exact files added
4. Migration files added
5. Tests added or updated
6. Known limitations that remain after Phase 2

Do not stop at planning. Perform the implementation.

Now begin by inspecting the repository structure and identifying the exact files that must be changed.
