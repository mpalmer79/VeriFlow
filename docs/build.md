You are acting as a staff-level full-stack engineer performing Phase 9 optimization and deployment-completion work on an existing FastAPI + SQLAlchemy + PostgreSQL + Next.js project named VeriFlow.

Phase 1 through Phase 8 already landed. The project now has:
- strong workflow, audit, and evidence lifecycle foundations
- signed content access
- preview/download flows
- evidence cleanup and integrity tooling
- CI with SQLite + PostgreSQL coverage
- Docker/deployment baseline
- document service modularization
- record detail page component extraction
- tighter config/security posture
- operations/admin UI surface
- Railway groundwork
- Playwright scaffolding

Phase 9 is about:
- materially reducing CI runtime
- removing duplicated backend test burden
- following through on frontend interaction testing
- tightening Railway deployment clarity
- applying a final restrained UX pass where it materially improves product quality

This is not a rewrite. This is a focused optimization and completion pass.

==================================================
OBJECTIVE
==================================================

Implement Phase 9 as a structured optimization pass covering:

1. CI runtime reduction with preserved confidence
2. Backend test classification and smarter SQLite/PostgreSQL split
3. Playwright follow-through with a few meaningful interaction tests
4. Railway deployment completion and config clarity
5. Final restrained frontend UX refinement for critical flows
6. Incremental Alembic migration only if schema changes are actually required

Do not stop at analysis. Inspect the repository, reconcile to actual file paths, and implement completely.

==================================================
VERY IMPORTANT CI DIRECTION
==================================================

Current problem:
CI is still too slow because the backend SQLite and PostgreSQL jobs appear to be running too much overlapping work.

Goal:
Speed up CI materially without fake optimization and without deleting meaningful confidence.

This does NOT mean:
- blindly skipping tests
- removing PostgreSQL coverage
- hiding failures
- weakening migrations/testing
- adding complexity without payoff

It DOES mean:
- classifying tests properly
- running broad fast coverage once
- running PostgreSQL only where it adds real value
- reducing duplicated setup cost
- keeping the workflow readable and honest

==================================================
VERY IMPORTANT UI/UX DIRECTION
==================================================

The frontend should continue improving in a restrained, serious way.

This does NOT mean:
- generic AI slop
- dashboard fluff
- emoji usage
- gratuitous icons
- decorative gradients
- fake enterprise chrome

It DOES mean:
- better state transitions
- better action hierarchy
- cleaner loading/error/success handling
- better admin/operations usability
- stronger polish through spacing, layout, and information structure

No emojis.
No gratuitous icons.
No ornamental clutter.

==================================================
NON-NEGOTIABLE EXECUTION RULES
==================================================

1. Inspect the repo first.
   - Read the current backend and frontend structure fully.
   - Identify actual files for:
     - GitHub Actions workflow(s)
     - pytest config / conftest / test layout
     - backend tests and fixtures
     - Playwright config and current tests
     - Railway config files and deployment docs
     - backend startup/config/migration flow
     - record detail page and operations/admin UI pieces
     - frontend API helpers/types
     - migrations

2. Preserve the current architecture.
   - Keep FastAPI + SQLAlchemy + local evidence storage
   - Keep Next.js app structure
   - Keep PostgreSQL CI coverage in some form
   - Do not redesign the app into microservices
   - Do not replace the testing stack unless necessary

3. Prefer modifying existing files.
   - Avoid duplication
   - Reuse existing test/config patterns
   - Add markers and structure rather than rewriting the whole suite

4. Keep correctness ahead of speed.
   - CI optimization must preserve meaningful trust
   - Railway docs/config must reflect actual deploy behavior
   - frontend testing should cover real flows, not toy checks

5. Do not overbuild.
   - no giant CI matrix
   - no giant E2E suite
   - no heavy deployment orchestration
   - no design-system rewrite

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
   - before/after CI design rationale

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
PHASE 9A — CI PERFORMANCE OPTIMIZATION
==================================================

Goal:
Cut CI runtime materially while preserving real confidence.

Known issue:
- backend SQLite and backend PostgreSQL jobs appear to duplicate too much work
- frontend is not the bottleneck

Required behavior:
Audit the current CI and redesign it so the backend jobs are better scoped.

Minimum required outcome:
1. Classify backend tests into categories such as:
   - fast/generic
   - postgres-specific
   - migration-sensitive
   - slow/integration
2. Add pytest markers or equivalent structure where appropriate
3. Change CI so:
   - SQLite runs the broad fast suite
   - PostgreSQL runs only the subset that actually benefits from PostgreSQL coverage
4. Keep Alembic/migration confidence where it matters
5. Preserve readability of the workflow

Requirements:
- do not just delete tests from CI
- do not run the full backend suite twice unless clearly justified
- do not make the workflow misleading
- use dependency caching effectively if not already optimal
- review fixture/setup scope for repeated expensive setup

Strongly consider:
- moving PostgreSQL-specific confidence into a smaller marked subset
- separating migration smoke tests from full broad backend execution if that saves meaningful time
- xdist only if the suite is stable and the speedup is real

At the end, explain:
- what runs in SQLite
- what runs in PostgreSQL
- why

==================================================
PHASE 9B — TEST SUITE STRUCTURE
==================================================

Goal:
Make the test structure match the CI strategy cleanly.

Required behavior:
1. Introduce clear pytest markers and/or file organization for:
   - postgres-only or postgres-sensitive tests
   - integration/slow tests if needed
2. Update test config so local developers can still run:
   - fast default tests easily
   - postgres-targeted tests intentionally
3. Keep current test ergonomics reasonable

Requirements:
- do not force every developer into a heavy Postgres loop by default
- do not claim Postgres confidence without actually running marked tests in CI
- keep conftest and fixtures understandable

Preferred outcome:
- fast default local loop remains
- CI is more efficient
- DB-specific confidence is preserved intentionally, not accidentally

==================================================
PHASE 9C — PLAYWRIGHT FOLLOW-THROUGH
==================================================

Goal:
Turn the current Playwright scaffolding into a small but meaningful frontend confidence layer.

Required behavior:
Add a few real Playwright tests for the highest-value user flows.

Recommended minimum flows:
1. record detail page loads critical sections
2. metadata-only documents do not expose invalid actions
3. upload-backed documents expose preview/download actions appropriately
4. preview modal opens and closes correctly
5. admin/operations page or admin surface renders expected sections for authorized access if practical in current setup

Requirements:
- keep the suite small and meaningful
- do not attempt huge E2E coverage in one pass
- prefer stable smoke-plus-critical-flow tests
- if auth setup is difficult, use the lightest credible setup that matches current app structure

Do not:
- add brittle placeholder tests
- create a large flaky browser suite
- overstate frontend confidence

==================================================
PHASE 9D — RAILWAY DEPLOYMENT COMPLETION
==================================================

Goal:
Tighten the Railway story from groundwork into something clearer and more deployment-ready.

Required behavior:
Inspect current Railway files/docs/config and improve clarity and correctness.

Focus on:
1. explicit backend start command expectations
2. explicit frontend start/build expectations
3. environment variable clarity
4. migration strategy on Railway
5. health/readiness path usage
6. seed behavior in hosted environments
7. service-to-service URL expectations

Requirements:
- be honest about what is manual vs automated
- do not auto-run unsafe seeding in hosted environments
- make Railway-specific docs more explicit if needed
- if `railway.json` or service config can be improved safely, do so

Preferred outcome:
A new engineer should be able to answer:
- how backend deploys on Railway
- how frontend deploys on Railway
- what env vars are required
- how migrations are run
- what is intentionally not automated

Do not:
- add fake production claims
- leave migration behavior ambiguous
- rely on local Docker assumptions as if they are Railway behavior

==================================================
PHASE 9E — FINAL RESTRAINED UX PASS
==================================================

Goal:
Apply one more focused UX refinement pass to the most important operational flows.

Targets:
- upload
- verify
- integrity check
- preview/download
- delete/reject
- operations/admin surface

Required behavior:
Refine:
1. loading states
2. success/failure feedback
3. admin action clarity
4. empty states
5. section hierarchy where still weak

Requirements:
- keep the restrained style
- no emojis
- no gratuitous icons
- no ornamental chrome
- no generic AI product wording
- improve clarity through structure, copy, spacing, and state behavior

This phase should be small and targeted.
Do not turn it into another broad UI rewrite.

==================================================
PHASE 9F — DOCS / ENGINEERING STORY CLEANUP
==================================================

Goal:
Make the repo’s engineering story match the new CI and deployment structure.

Required behavior:
Update README and/or deployment docs to reflect:
- new CI strategy
- test markers / local test options
- Playwright test scope
- Railway deployment flow
- migration strategy
- limitations that still remain

Requirements:
- concise
- honest
- no fluff
- no exaggerated claims

==================================================
TESTING REQUIREMENTS
==================================================

Extend the test suite as needed.

At minimum add/update tests for:
1. CI/test marker structure works as intended
2. postgres-only or db-sensitive test selection behaves correctly
3. any workflow/config assumptions introduced are valid
4. Playwright tests cover a few real flows
5. Railway/deployment docs/config align with actual startup behavior
6. any refined frontend state handling still behaves correctly

Use existing patterns where possible.
Do not create a giant framework unless justified.

==================================================
IMPLEMENTATION DISCOVERY STEPS
==================================================

Before editing:
1. Read current CI workflow(s) and identify duplicated work
2. Read current pytest config, conftest, and test layout
3. Determine whether markers already exist
4. Read current Playwright setup and current npm scripts
5. Read current Railway files/docs and backend/frontend start behavior
6. Read current record-detail and operations UI files to find the weakest remaining state/interaction areas

Then implement the changes.

==================================================
ACCEPTANCE CRITERIA
==================================================

- CI runtime is materially improved by reducing duplicated backend burden
- SQLite remains the fast broad feedback loop
- PostgreSQL remains a real but narrower confidence layer
- Playwright has a few meaningful real tests
- Railway deployment story is clearer and more complete
- frontend operational flows feel more deliberate and polished
- docs reflect the actual new workflow honestly
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
7. Before vs after CI strategy and expected runtime impact

Now begin by inspecting the repository and identifying exact files to modify.
