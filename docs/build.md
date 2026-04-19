You are acting as a staff-level full-stack engineer performing Phase 6 hardening on an existing FastAPI + SQLAlchemy + PostgreSQL + Next.js project named VeriFlow.

Phase 1 through Phase 5 already landed. The repo now has:
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
- inline preview UX for PDF / PNG / JPEG
- range request support on the content endpoint
- record-scoped evidence summary
- org-scoped storage inventory endpoint

Your job in Phase 6 is to improve access control, retention/cleanup operations, accessibility, and browser/app security posture without breaking the current architecture.

This is not a rewrite. This is a focused security and operational-maturity pass.

==================================================
OBJECTIVE
==================================================

Implement the following Phase 6 upgrades:

1. Short-lived signed content access flow for preview/download
2. Safe orphan cleanup workflow and retention-oriented storage tooling
3. Role-based protection for admin/debug reporting routes
4. Accessibility pass for the preview modal and related evidence UI
5. App-wide security header / CSP hardening where appropriate
6. Tests covering the new behavior
7. Explicit incremental Alembic migration only if schema changes are required

Do not stop at analysis. Inspect the repo, reconcile to actual file paths, and implement completely.

==================================================
NON-NEGOTIABLE EXECUTION RULES
==================================================

1. Inspect the repo first.
   - Read the current backend and frontend structure fully.
   - Identify the actual files for:
     - auth/security helpers
     - user model / roles / auth dependencies
     - content delivery route
     - document routes
     - audit/storage inventory routes
     - evidence storage helper
     - document service
     - config/settings
     - app startup / middleware
     - frontend API helpers/types
     - record detail page
     - preview modal UI
     - tests
     - migrations
   - Confirm the current preview/download flow before changing it.

2. Preserve the current architecture.
   - Keep FastAPI + SQLAlchemy + local evidence storage
   - Keep Next.js app structure as-is
   - Do not introduce cloud storage
   - Do not introduce background workers
   - Do not redesign the core auth architecture unless required for role checks
   - Do not redesign the data model unless truly necessary

3. Prefer modifying existing files.
   - Avoid duplicate components and helpers
   - Reuse existing patterns for API calls, UI state, auth dependencies, and route organization

4. Keep security and correctness ahead of convenience.
   - Do not expose raw filesystem paths
   - Do not allow unsafe cleanup of managed storage
   - Do not weaken existing org-scoped authorization
   - Do not create long-lived signed access that effectively bypasses auth
   - Do not add destructive admin actions without deliberate safeguards

5. No fake UX.
   - If signed preview/download links are introduced, they must actually enforce expiry and scope
   - If retention tooling is dry-run only, the UI and API must say so
   - Do not imply automatic cleanup exists if only reporting exists

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
PHASE 6 REQUIREMENTS
==================================================

----------------------------------------
A. SHORT-LIVED SIGNED CONTENT ACCESS
----------------------------------------

Goal:
Improve preview/download UX by allowing direct media loading without requiring the frontend to fetch the entire blob with a bearer token first.

You must inspect the current auth and content-delivery implementation first.

Required behavior:
Implement a short-lived signed access flow for document content.

Preferred approach:
1. Add a backend endpoint that issues a short-lived signed access token or signed URL descriptor for a specific document content request
2. Add a content-serving path that validates the signed token and serves only the intended document, for a short time window
3. Support both preview and download semantics safely

Requirements:
- token/link must be short-lived
- token/link must be scoped to:
  - one document
  - one disposition mode if appropriate
  - one organization or user context if feasible within existing auth model
- signed content route must still enforce managed-path safety
- metadata-only documents must not be eligible
- do not expose filesystem paths
- signed access must not become a general auth bypass

Good acceptable options:
- JWT-like signed content token
- HMAC-signed query parameters with expiry
- another lightweight signed mechanism that fits the repo

Preferred route style:
- POST /api/documents/{id}/signed-access
- GET /api/documents/content/signed?...   or equivalent

Frontend:
- update preview/download flow to use short-lived signed access for upload-backed docs where appropriate
- reduce or eliminate full-blob prefetch for preview if cleanly possible

Do not:
- create long-lived tokens
- persist signed links unnecessarily
- weaken org/user scoping
- add a full CDN architecture

----------------------------------------
B. SAFE ORPHAN CLEANUP / RETENTION TOOLING
----------------------------------------

Goal:
Move from orphan reporting to a safe operational cleanup workflow.

You must inspect existing storage inventory behavior first.

Required behavior:
Implement a safe, bounded cleanup capability for managed orphaned files OR a structured dry-run + explicit cleanup workflow.

Preferred design:
1. Add a dry-run report for orphaned managed files
2. Add a separate explicit cleanup action that only removes:
   - files under the managed root
   - files not referenced by any live document row
3. Return counts/totals, not raw internal paths unless the route is clearly admin-only and even then be cautious

Requirements:
- must never delete outside the managed storage root
- must only consider files managed by the app
- must tolerate race conditions where a file disappears between scan and delete
- must be scoped safely
- cleanup should be deliberate, not automatic by default

Preferred route shape:
- GET /api/audit/storage-inventory   existing report
- POST /api/audit/storage-cleanup?dry_run=true|false   or equivalent

If destructive cleanup is added:
- require admin-level protection
- return structured counts:
  - files_examined
  - orphaned_found
  - orphaned_deleted
  - bytes_reclaimed
  - errors

Do not:
- automatically sweep at startup
- build a scheduler
- delete files referenced by live rows
- trust unvalidated storage URIs

----------------------------------------
C. ROLE-BASED PROTECTION FOR ADMIN/DEBUG ROUTES
----------------------------------------

Goal:
Stop treating all authenticated users the same for operational routes.

You must inspect the current auth dependency and user/role model first.

Required behavior:
Protect admin/debug routes such as:
- audit chain verification
- storage inventory
- storage cleanup if added
- any other operational-only routes

Requirements:
- use existing role model if present
- if roles already exist, wire proper authorization checks
- if a minimal admin role concept already exists but is unused, activate it
- if no viable role mechanism exists, add the smallest correct role-based guard consistent with the current auth model

Preferred behavior:
- normal users can access record/document routes within their org
- admin/debug routes require elevated role

Do not:
- redesign the full RBAC model unless necessary
- add giant permissions matrices
- leave operational routes broadly exposed

If schema changes are required for roles:
- use a proper incremental migration
- keep the change minimal

----------------------------------------
D. ACCESSIBILITY PASS FOR PREVIEW MODAL / EVIDENCE UI
----------------------------------------

Goal:
Fix the known accessibility weakness in the preview UX.

Required behavior:
Improve the preview modal and related controls so they behave more like a real accessible dialog.

At minimum:
- keyboard focus moves into the modal on open
- Escape closes the modal
- focus returns to the trigger on close
- tab focus stays trapped inside the modal while open
- dialog has appropriate labels / semantics
- close control is keyboard accessible

Also review:
- button labels for Preview / Download / Integrity check
- status chips for metadata-only docs
- screen-reader-friendly text where needed

Do not:
- introduce a giant component library unless already present
- rebuild the whole page layout

Preferred approach:
- use current frontend patterns
- keep modal lightweight and accessible

----------------------------------------
E. APP-WIDE SECURITY HEADER / CSP HARDENING
----------------------------------------

Goal:
Improve browser-facing security posture at the app level.

You must inspect current FastAPI app startup / middleware first.

Required behavior:
Add deliberate application-level security headers where appropriate.

Consider:
- Content-Security-Policy
- X-Frame-Options or frame-ancestors via CSP
- Referrer-Policy if not already app-wide
- X-Content-Type-Options if not already app-wide
- Permissions-Policy where practical

Requirements:
- do not break the current preview flow
- if PDF/image preview requires inline rendering, ensure CSP is compatible
- keep the policy realistic for the current app
- avoid a fake “secure headers” patch that breaks functionality

Preferred outcome:
- app-level middleware or equivalent sets a coherent baseline
- content route can still apply route-specific headers if needed

Do not:
- add a CSP that breaks the frontend
- claim security hardening without validating app behavior after the change

----------------------------------------
F. FRONTEND/API CONTRACT CLEANUP
----------------------------------------

Goal:
Reflect signed access, admin scoping, and preview improvements correctly in the UI.

Required behavior:
1. Update frontend API helpers and types as needed
2. Prefer signed access flow for preview/download if implemented
3. Ensure metadata-only docs never offer false preview/download actions
4. Keep capability-driven rendering
5. If admin-only features are surfaced in UI, show them only when appropriate

Do not:
- assume admin status without backend truth
- leave stale blob/object URL cleanup bugs behind
- create inconsistent fallback behavior

----------------------------------------
G. TESTING
----------------------------------------

Extend the current test suite.

At minimum add/update tests for:
1. signed content access succeeds for the intended document and expires correctly
2. signed access cannot be reused outside scope or after expiry
3. metadata-only docs cannot get signed access
4. admin/debug routes are denied to non-admins
5. storage cleanup dry-run vs destructive mode behaves correctly
6. cleanup never deletes outside managed storage root
7. accessibility-critical frontend behavior is at least covered where current test setup allows, or clearly explain if frontend test infra is absent
8. app-level security headers are present and do not break core content flows
9. range/preview/download still work after the signed-access and header changes

Use existing test patterns and fixtures.
Do not create a new framework.

==================================================
IMPLEMENTATION DISCOVERY STEPS
==================================================

Before editing:
1. Read current backend files for:
   - auth/security helpers
   - user model / roles
   - document routes
   - audit routes
   - evidence storage helper
   - app startup / middleware
   - config
   - migrations
2. Read current frontend files for:
   - records detail page
   - API client
   - shared types
   - preview modal implementation
3. Determine whether any role mechanism already exists.
4. Determine whether signed access can reuse existing token utilities safely.
5. Determine current testing patterns for backend and frontend.

Then implement the changes.

==================================================
ACCEPTANCE CRITERIA
==================================================

- upload-backed evidence can be previewed/downloaded through a short-lived signed access flow or an equally safe direct mechanism
- metadata-only docs cannot obtain content access
- orphan cleanup workflow is safe, deliberate, and root-bounded
- admin/debug routes are no longer broadly exposed
- preview modal accessibility is materially improved
- app-level security headers are deliberate and compatible with current behavior
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
