You are acting as a staff-level full-stack engineer performing Phase 8 hardening and product refinement on an existing FastAPI + SQLAlchemy + PostgreSQL + Next.js project named VeriFlow.

Phase 1 through Phase 7 already landed. The project now has:
- strong workflow, audit, and evidence lifecycle foundations
- signed content access
- preview/download flows
- evidence cleanup and integrity tooling
- CI with SQLite + PostgreSQL coverage
- Docker/deployment baseline
- document service modularization
- record detail page component extraction
- tighter config/security posture

Phase 8 is about pushing the project from "strong engineering system" to "credible product experience with cleaner deployment readiness".

This phase must focus on:
- frontend interaction quality
- restrained UI/UX polish
- better operational/admin UI surface
- frontend testing groundwork
- Railway deployment groundwork

This is not a rewrite. This is a focused productization and deployment-readiness pass.

==================================================
OBJECTIVE
==================================================

Implement Phase 8 as a structured improvement pass covering:

1. Frontend interaction polish and product feel
2. Better loading / empty / error / destructive-action UX
3. Admin/operational tooling UI surface
4. Frontend interaction testing groundwork
5. Railway deployment groundwork for backend and frontend
6. Supporting docs/config for Railway
7. Incremental Alembic migration only if schema changes are actually required

Do not stop at analysis. Inspect the repository, reconcile to actual file paths, and implement completely.

==================================================
VERY IMPORTANT UI/UX DIRECTION
==================================================

The UI must improve in a restrained, serious way.

This does NOT mean:
- generic AI slop
- trendy dashboard fluff
- icons everywhere
- emoji usage
- decorative gradients
- over-animated interactions
- noisy cards that say nothing

It DOES mean:
- stronger hierarchy
- better information density decisions
- better action grouping
- more deliberate visual rhythm
- clearer state handling
- more coherent confirmations and error messaging
- more product-like interaction flow
- less “assembled components”, more “designed screen”

Style requirements:
- no emojis
- no gratuitous icons
- no ornamental chrome
- no generic AI-generated labels
- no filler copy
- keep it calm, credible, operational, and polished
- typography, spacing, borders, structure, and state behavior should do the work

The result should feel like a real internal operations product used by serious teams.

==================================================
NON-NEGOTIABLE EXECUTION RULES
==================================================

1. Inspect the repo first.
   - Read the current backend and frontend structure fully.
   - Identify actual files for:
     - record detail page and extracted components
     - admin/debug routes and any current admin surfaces
     - frontend API helpers/types
     - auth/session/token usage in frontend
     - app config and environment loading
     - Docker/deployment assets
     - README/docs
     - CI files
     - migrations
   - Confirm the current preview, download, verify, integrity, delete, and admin route behavior before changing them.

2. Preserve the current architecture.
   - Keep FastAPI + SQLAlchemy + local evidence storage
   - Keep Next.js app structure
   - Keep current backend route structure unless a small cleanup is clearly better
   - Do not redesign auth architecture
   - Do not replace the evidence model
   - Do not introduce cloud storage or new infrastructure providers beyond Railway groundwork

3. Prefer modifying existing files.
   - Avoid duplication
   - Reuse current components/helpers where sensible
   - Extract additional components only when they improve clarity

4. Keep correctness ahead of appearance.
   - UI polish must improve usability, not just appearance
   - Railway groundwork must be real and coherent
   - Testing groundwork must support future confidence, not just check a box

5. Do not overbuild.
   - No giant admin dashboard
   - No design-system rewrite
   - No heavy frontend framework changes
   - No premature multi-environment deployment complexity

6. Minimal comments.
   - No AI-style comments
   - No tutorial comments
   - Only concise human comments where needed

7. At the end, provide:
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
NO BASELINE MODIFICATION
----------------------------------------

You MUST treat:

    0001_initial_schema.py

as immutable.

If you think it needs to change:
→ you are wrong
→ create a new migration

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
PHASE 8A — FRONTEND INTERACTION POLISH
==================================================

Goal:
Improve the record-detail experience so it feels like a real product surface, not just a capability hub.

Known concern:
- frontend is better structured now, but still likely lags the backend in overall polish and interaction quality

Required behavior:
Refine the record detail UX with focus on:
- hierarchy
- grouping
- action clarity
- state handling
- visual rhythm

Key improvements to target:
1. Better grouping of:
   - record summary
   - workflow status
   - evaluation state
   - evidence actions
   - audit/operational context
2. Better action placement so destructive or secondary actions do not compete with primary actions
3. Better local state feedback around:
   - upload
   - verify
   - integrity check
   - preview
   - delete
4. Better spacing and density so the screen feels deliberate rather than assembled

Requirements:
- keep the restrained style
- no icons unless absolutely necessary and materially useful
- no decorative design tricks
- use layout, spacing, borders, and copy quality to improve the feel

Do not:
- redesign the whole page into a flashy dashboard
- reduce useful information density too much
- hide important operational detail behind unnecessary clicks

==================================================
PHASE 8B — LOADING / EMPTY / ERROR / CONFIRMATION UX
==================================================

Goal:
Make the UI feel more product-complete through better states and interactions.

Required behavior:
Review and improve:
- loading states
- empty states
- error states
- destructive confirmations
- success/failure feedback

Targets:
1. Upload flow
2. Verify flow
3. Integrity check flow
4. Delete document flow
5. Preview/download flow
6. Any admin/debug actions surfaced in UI

Requirements:
- replace crude/native interaction where a better app-level pattern is reasonable
- avoid modal spam
- confirmations should be deliberate, readable, and not generic
- errors should be specific and operationally useful
- empty states should not look unfinished

If native browser dialogs are still in use for key flows:
- replace them with a restrained in-app confirmation pattern if feasible within current stack

Do not:
- add toast spam everywhere
- add generic “Something went wrong” messages when backend errors can be surfaced meaningfully

==================================================
PHASE 8C — ADMIN / OPERATIONAL TOOLING UI SURFACE
==================================================

Goal:
Expose the existing admin/debug capabilities in a restrained UI for authorized users.

Known concern:
- admin/debug tooling exists in backend but likely lacks product UI

Required behavior:
Add a minimal admin/operations surface for existing capabilities such as:
- audit chain verification
- storage inventory
- storage cleanup dry-run / execution if present
- evidence summary / integrity summary if useful

Requirements:
1. Inspect current auth/role awareness in frontend and backend
2. Only surface admin features when appropriate
3. Keep the admin surface narrow and operational
4. It can live:
   - on the record detail page in an admin-only section
   - on a small dedicated admin page
   - or both if clearly justified

Preferred characteristics:
- clean tables or summary panels
- clear counts and statuses
- deliberate action placement
- no “admin console” theatrics

Do not:
- build a giant dashboard
- expose unsafe operational actions casually
- guess admin capability purely on the frontend if backend truth can be fetched or inferred reliably

==================================================
PHASE 8D — FRONTEND TESTING GROUNDWORK
==================================================

Goal:
Begin closing the frontend confidence gap.

Known concern:
- no real frontend interaction tests yet

Required behavior:
Add the smallest credible frontend testing foundation that fits the repo.

Preferred path:
- Playwright for high-value end-to-end interaction coverage
OR
- a small existing-compatible testing setup if Playwright is too disruptive

At minimum, create groundwork for testing core flows such as:
- upload form presence and interaction
- preview modal open/close
- integrity-check action visibility
- metadata-only vs upload-backed action gating
- admin-only surface visibility if surfaced in UI

Requirements:
- keep setup realistic
- do not add a giant test matrix
- prefer a few meaningful tests over large fake coverage

If full interaction testing cannot be completed in one pass:
- still add the foundation and at least one or two meaningful tests
- document what remains

Do not:
- add brittle placeholder tests
- claim frontend confidence without exercising real interaction paths

==================================================
PHASE 8E — RAILWAY DEPLOYMENT GROUNDWORK
==================================================

Goal:
Start making the project Railway-ready in a clean, credible way.

Required behavior:
Add groundwork for deploying backend and frontend to Railway.

This should include, as appropriate after inspecting the repo:
1. Railway-oriented run/start commands
2. Environment variable documentation
3. Backend and frontend service expectations
4. Healthcheck/readiness path clarity
5. Build/start assumptions that match Railway deployment reality
6. Optional `railway.json` files if they materially help and fit the repo
7. README/deployment docs section for Railway

Targets:
- backend service
- frontend service
- Postgres service assumptions
- migration expectations on deploy

Requirements:
- do not invent magical automation
- be explicit about what Railway needs:
  - env vars
  - start commands
  - migrations
  - service URLs
- if Railway deployment should not auto-run destructive or dev-only seed behavior, fix/document that clearly
- ensure Docker and/or standard build strategy makes sense for Railway

Preferred outcome:
A new engineer should be able to understand:
- how to deploy backend to Railway
- how to deploy frontend to Railway
- what env vars are needed
- how migrations are run safely
- how services point to one another

Important:
- local `docker-compose` convenience is not the same as Railway reality
- deployment docs must reflect that honestly

Do not:
- add fake production claims
- auto-run unsafe seeds in hosted environments
- leave ambiguous whether migrations happen on startup, release, or manual step

==================================================
PHASE 8F — DEPLOYMENT / CONFIG CLEANUP
==================================================

Goal:
Tighten the project’s deployment story beyond just adding docs.

Required behavior:
Inspect startup/config behavior and improve anything that makes Railway or production-style deployment feel brittle.

Examples of good targets:
- make seed behavior explicitly dev-only if needed
- make environment assumptions clearer
- make backend/frontend URLs/config naming clearer
- improve health endpoint clarity
- reduce accidental reliance on local defaults

Do not:
- introduce environment sprawl without reason
- silently preserve unsafe hosted defaults

==================================================
PHASE 8G — README / DOCS REFINEMENT
==================================================

Goal:
Update the docs to reflect the stronger frontend and Railway groundwork.

Required behavior:
Update README and/or docs to cover:
- product capabilities
- local development
- CI
- Docker
- Railway deployment
- migrations
- environment variables
- frontend testing setup if added
- known hosted limitations

Requirements:
- concise
- honest
- no marketing fluff
- no exaggerated claims

==================================================
TESTING REQUIREMENTS
==================================================

Extend the test suite as needed.

At minimum add/update tests for:
1. frontend/product-state groundwork if test infra is added
2. admin surface visibility or gating logic where feasible
3. Railway/deployment config consistency if practical
4. startup/config safety related to hosted environments
5. any replacement of native confirmations or state handling
6. docs/config assumptions reflected in code

Use existing patterns where possible.
Do not create a giant framework unless justified.

==================================================
IMPLEMENTATION DISCOVERY STEPS
==================================================

Before editing:
1. Read current backend files for:
   - auth/roles
   - admin/debug routes
   - config
   - startup behavior
   - deploy-related docs/assets
2. Read current frontend files for:
   - record detail page
   - extracted record-detail components
   - api client
   - shared types
3. Determine whether any frontend test framework already exists
4. Determine whether Railway-specific files already exist
5. Determine how seeds and migrations currently behave in Docker/hosted contexts
6. Determine current README/deployment documentation quality

Then implement the changes.

==================================================
ACCEPTANCE CRITERIA
==================================================

- record-detail experience feels more product-like and less scaffold-like
- loading/error/empty/confirm flows are materially improved
- admin/debug tooling has a restrained UI surface for authorized use
- frontend testing groundwork exists and exercises at least a few meaningful interactions
- Railway deployment groundwork is real and documented
- deployment/config behavior is cleaner and more hosted-safe
- docs tell a credible product and deployment story
- no generic AI slop appears in the UI
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
