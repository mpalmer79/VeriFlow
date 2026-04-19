You are acting as a staff-level full-stack engineer performing Phase 5 hardening on an existing FastAPI + SQLAlchemy + PostgreSQL + Next.js project named VeriFlow.

Phase 1 through Phase 4 already landed. The repo now has:
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
- secure content delivery endpoint
- streaming upload hashing and storage
- record-level managed file cleanup
- audit chain verification endpoint

Your job in Phase 5 is to improve evidence usability, lifecycle policy, and operational maturity without breaking the current architecture.

This is not a rewrite. This is a focused product-hardening and operational-completion pass.

==================================================
OBJECTIVE
==================================================

Implement the following Phase 5 upgrades:

1. Inline evidence preview UX for upload-backed documents
2. Retention / storage lifecycle controls and cleanup tooling
3. Record-scoped storage and integrity operational summary
4. Optional range-request support for content delivery if it fits cleanly
5. Defensive download/preview header hardening
6. Tests covering the new behavior
7. Explicit incremental Alembic migration only if schema changes are required

Do not stop at analysis. Inspect the repo, reconcile to actual file paths, and implement completely.

==================================================
NON-NEGOTIABLE EXECUTION RULES
==================================================

1. Inspect the repo first.
   - Read the current backend and frontend structure fully.
   - Identify the actual files for:
     - content delivery route
     - document routes
     - record routes
     - evidence storage helper
     - document service
     - record service
     - audit/debug routes
     - config/settings
     - frontend API helpers/types
     - record detail page
     - tests
     - migrations
   - Confirm the current upload, verify, integrity-check, download, and delete flows before changing them.

2. Preserve the current architecture.
   - Keep FastAPI + SQLAlchemy + local evidence storage
   - Keep Next.js app structure as-is
   - Do not introduce cloud storage
   - Do not introduce background workers
   - Do not redesign auth architecture
   - Do not redesign the data model unless truly necessary

3. Prefer modifying existing files.
   - Avoid duplicate components and helpers
   - Reuse current patterns for API calls, UI state, cards, tables, and error handling

4. Keep security and correctness ahead of convenience.
   - Do not expose raw filesystem paths
   - Do not allow preview/download actions for metadata-only documents
   - Do not weaken existing org-scoped authorization
   - Do not introduce unsafe cleanup that deletes files outside the managed storage root

5. No fake UX.
   - Only show preview actions for content types actually supported by the frontend preview experience
   - Do not show preview buttons for unsupported types unless the UI clearly falls back to download-only
   - Do not imply retention policy exists if it does not

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
PHASE 5 REQUIREMENTS
==================================================

----------------------------------------
A. INLINE EVIDENCE PREVIEW UX
----------------------------------------

Goal:
Allow users to preview supported upload-backed evidence directly from the record detail page instead of always downloading.

Required behavior:
1. Inspect current document UI on the record detail page.
2. Add preview support for at least:
   - PDF
   - PNG
   - JPEG
3. Preview should only be available for upload-backed documents with stored content.
4. Metadata-only docs must not show preview actions.
5. Unsupported content types should fall back to download-only.

Preferred UX:
- “Preview” button per eligible document
- modal, drawer, or inline panel using existing UI conventions
- minimal and clean
- preserve current document list usability

Backend/API requirements:
- reuse the secure content endpoint where appropriate
- do not expose raw storage paths
- preserve auth boundaries

Implementation guidance:
- For PDFs, an iframe or browser-native embed is acceptable if done safely
- For images, object URL or blob-backed preview is acceptable
- Reuse existing API helper patterns

Do not:
- build a giant document viewer
- add a heavy PDF rendering framework unless absolutely necessary
- expose preview for metadata-only documents

----------------------------------------
B. RETENTION / STORAGE LIFECYCLE CONTROLS
----------------------------------------

Goal:
Start making evidence lifecycle operationally explicit.

You must inspect current deletion and storage helpers first.

Required behavior:
Implement a lightweight, practical retention/control layer that fits the current local-storage architecture.

Choose the best fit after inspecting the repo. Acceptable options include:

Option 1: Record-level storage summary + stale/orphan cleanup helper
Option 2: Manual cleanup endpoint/service for managed evidence not referenced by live rows
Option 3: Retention policy configuration with dry-run reporting only

Minimum acceptable Phase 5 outcome:
- a safe way to identify orphaned managed files
- a safe way to report storage footprint by record or org
- optional cleanup action if it can be done safely within current architecture

Requirements:
- never delete outside the managed storage root
- distinguish live referenced files vs orphaned files
- do not rely on DB row existence alone without checking managed storage state
- keep it operationally useful, not theoretical

Preferred design:
- centralize filesystem scanning in `evidence_storage.py`
- keep destructive cleanup opt-in and safe
- if automatic deletion is risky, provide dry-run reporting instead

Do not:
- build a scheduler
- build a full quota management system
- overpromise retention guarantees

----------------------------------------
C. RECORD-SCOPED OPERATIONAL SUMMARY
----------------------------------------

Goal:
Give operators a concise view of evidence/storage/integrity state for a record.

Required behavior:
Add a read-only backend summary for a single record that includes useful operational information, such as:
- document count
- upload-backed count
- metadata-only count
- total stored bytes for managed evidence
- integrity-check-able count
- missing-content count
- last verification state summary if feasible
- optionally download/preview capability indicators

Preferred route:
- GET /api/records/{id}/evidence-summary
or equivalent consistent with current route style

Frontend:
- surface this summary on the record detail page in a lightweight way
- do not clutter the UI
- integrate with existing document/status area

Do not:
- dump raw storage URIs
- create a huge analytics dashboard
- mix this up with workflow evaluation status

----------------------------------------
D. OPTIONAL RANGE REQUEST SUPPORT
----------------------------------------

Goal:
Improve content serving for PDFs and large files, but only if it fits cleanly.

You must inspect the current content endpoint first.

If range support can be added cleanly without destabilizing the route:
- support basic `Range` handling for content delivery
- especially useful for PDF preview/browser-native viewing

If it cannot be added safely within scope:
- do not force it
- keep the endpoint correct and document that range support is deferred

Requirements if implemented:
- preserve org-scoped authorization
- preserve managed-path safety checks
- return correct partial content semantics
- do not expose internal paths

Do not:
- implement a broken partial-content layer
- guess at HTTP range semantics

----------------------------------------
E. DOWNLOAD/PREVIEW HEADER HARDENING
----------------------------------------

Goal:
Tighten content response behavior.

Required behavior:
Review and improve headers for content delivery and preview.

Consider:
- Content-Disposition
- Content-Type
- Cache-Control
- X-Content-Type-Options: nosniff
- inline vs attachment semantics depending on preview/download flow

Requirements:
- header behavior must be deliberate
- preview and download should behave predictably
- do not weaken current safety posture

Do not:
- rely on browser guesswork
- expose unsafe filenames

----------------------------------------
F. ADMIN / DEBUG TOOLING
----------------------------------------

Goal:
Add one small operational tool that helps validate storage state.

Pick one best-fit addition after inspecting current tooling.

Good options:
1. Managed storage inventory summary
2. Orphaned-file dry-run report
3. Record evidence audit/storage combined summary
4. Organization storage summary

Preferred characteristics:
- read-only by default
- narrow
- useful
- secure
- consistent with current auth patterns

Do not:
- build a giant admin panel
- dump filesystem internals casually
- create destructive tooling unless very clearly safe

----------------------------------------
G. FRONTEND/API CONTRACT CLEANUP
----------------------------------------

Goal:
Reflect preview/download/storage summary capabilities correctly in the UI.

Required behavior:
1. Update frontend types and API helpers as needed
2. Add preview/download actions only where supported
3. Render metadata-only vs upload-backed distinction clearly
4. Surface evidence summary data coherently
5. Keep UI capability-driven, not heuristic-driven

If backend needs to expose derived fields for clarity, do so without unnecessary persisted schema.

----------------------------------------
H. TESTING
----------------------------------------

Extend the current test suite.

At minimum add/update tests for:
1. preview/download endpoint behavior for upload-backed docs
2. metadata-only docs do not expose false preview/download capabilities
3. evidence summary returns coherent counts and totals
4. storage/orphan reporting works correctly
5. any cleanup tooling is safe and root-bounded
6. range support if implemented
7. header behavior is deliberate and correct
8. frontend-facing API contract remains consistent

Use existing test patterns and fixtures.
Do not create a new framework.

==================================================
IMPLEMENTATION DISCOVERY STEPS
==================================================

Before editing:
1. Read current backend files for:
   - documents content route
   - record routes
   - evidence storage helper
   - document service
   - audit/debug routes
   - config
   - migrations
2. Read current frontend files for:
   - records detail page
   - API client
   - shared types
3. Determine whether current content endpoint is suitable for preview reuse.
4. Determine current storage helper capabilities and whether orphan scanning exists.
5. Determine current testing patterns.

Then implement the changes.

==================================================
ACCEPTANCE CRITERIA
==================================================

- supported upload-backed evidence can be previewed in the UI
- metadata-only docs never expose false preview actions
- record-level evidence summary exists and is useful
- storage/orphan tooling materially improves operational visibility
- header behavior for content delivery is deliberate and hardened
- range support is either implemented correctly or explicitly deferred
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
