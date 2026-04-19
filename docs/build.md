You are acting as a staff-level full-stack engineer performing Phase 3 hardening on an existing FastAPI + SQLAlchemy + PostgreSQL + Next.js project named VeriFlow.

Phase 1 and Phase 2 already landed. The repo now has:
- optimistic concurrency on records
- tamper-evident audit chaining
- stronger JWT claims/validation
- real evidence storage on local disk
- multipart document upload
- verification-time re-hash
- document integrity-check endpoint
- blocked-transition risk mutation fix
- Alembic bootstrap with a baseline migration

Your job in Phase 3 is to improve operational completeness and product usability without breaking the current architecture.

This is not a rewrite. This is a focused hardening and completion pass.

==================================================
OBJECTIVE
==================================================

Implement the following Phase 3 upgrades:

1. Frontend wiring for real document upload
2. Frontend wiring for integrity-check visibility
3. Evidence deletion / cleanup lifecycle
4. Stronger file validation at ingest
5. Explicit incremental Alembic migration for Phase 3 changes if schema changes are required
6. Admin/debug integrity tooling where appropriate
7. Tests covering the new behavior

Do not stop at analysis. Inspect the repo, reconcile to actual file paths, and implement completely.

==================================================
NON-NEGOTIABLE EXECUTION RULES
==================================================

1. Inspect the repo first.
   - Read the current backend and frontend structure fully.
   - Identify the actual files for:
     - records detail page
     - frontend API client/types
     - document routes
     - document service
     - evidence storage
     - config/settings
     - migrations
     - tests
   - Confirm the existing UI path where document verify/reject actions already live.

2. Preserve the current architecture.
   - Keep FastAPI + SQLAlchemy + local evidence storage
   - Keep Next.js app structure as-is
   - Do not introduce cloud storage
   - Do not introduce background workers
   - Do not redesign the entire frontend

3. Prefer modifying existing files.
   - Avoid duplicate components
   - Reuse existing patterns for API calls, UI state, error handling, and tables/cards

4. No fake UX.
   - Do not expose a “Verify” happy path in the UI for metadata-only documents as if they were real uploaded evidence
   - The UI must reflect whether a document has stored content
   - Integrity status must reflect actual backend results

5. Keep security and correctness ahead of convenience.
   - Do not trust filename extension alone
   - Do not expose absolute storage paths to users
   - Do not let deletion leave silent orphan files where avoidable

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

Example:

def upgrade():
    op.add_column(
        "documents",
        sa.Column("has_stored_content", sa.Boolean(), nullable=True),
    )

def downgrade():
    op.drop_column("documents", "has_stored_content")

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
PHASE 3 REQUIREMENTS
==================================================

----------------------------------------
A. FRONTEND: REAL DOCUMENT UPLOAD
----------------------------------------

Wire the UI to:

POST /api/records/{id}/documents/upload

Requirements:
- file picker
- document type selection (if required)
- optional label/notes
- refresh document list after upload
- disable duplicate submission
- handle errors cleanly

Must clearly distinguish:
- metadata-only documents
- real uploaded evidence

Do not expose storage URIs.

----------------------------------------
B. FRONTEND: INTEGRITY CHECK
----------------------------------------

Use:

/api/documents/{id}/integrity-check

Display:
- match
- mismatch
- missing content

Requirements:
- action button per document
- visible result without reload
- not available for metadata-only docs

Do not mutate document state.

----------------------------------------
C. EVIDENCE DELETION / CLEANUP
----------------------------------------

When deleting a document:
- delete DB row
- delete file from disk if managed
- ensure path is inside storage root
- handle missing files safely
- emit audit event

Do not allow path traversal.

----------------------------------------
D. FILE VALIDATION AT INGEST
----------------------------------------

Add validation:
- allowlist file types (PDF, PNG, JPEG minimum)
- reject unsupported types
- prefer lightweight magic-byte detection if feasible

Behavior:
- mismatch → reject or normalize
- unsupported → 400

Do not trust extension alone.

----------------------------------------
E. FRONTEND/API CONTRACT CLEANUP
----------------------------------------

Ensure UI reflects backend truth:
- show which docs have stored content
- hide or disable invalid actions
- avoid frontend guessing

Add fields like:
- has_stored_content (if needed)

----------------------------------------
F. ADMIN / DEBUG TOOLING
----------------------------------------

Add ONE small tool:
- document integrity summary OR
- file existence check OR
- per-record integrity overview

Keep it minimal and secure.

----------------------------------------
G. ALEMBIC (IF NEEDED)
----------------------------------------

If schema changes occur:
- create new incremental migration
- do NOT modify baseline

If not:
→ state clearly no migration needed

----------------------------------------
H. TESTING
----------------------------------------

Add/update tests for:
- upload flow
- file validation
- integrity check
- metadata vs real doc behavior
- deletion cleanup
- edge cases

Use existing patterns.

==================================================
ACCEPTANCE CRITERIA
==================================================

- real upload works from UI
- integrity check visible in UI
- metadata vs real docs clearly separated
- deletion cleans up files safely
- file validation improved
- migrations handled correctly
- tests pass
- no runtime inconsistencies

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
