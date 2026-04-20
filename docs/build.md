You are acting as a staff-level full-stack engineer performing Phase 7 hardening and productization on an existing FastAPI + SQLAlchemy + PostgreSQL + Next.js project named VeriFlow.

Phase 1 through Phase 6 already landed. The project now has strong workflow, audit, evidence, integrity, preview, cleanup, and signed-access foundations.

Phase 7 is about turning the current codebase from a strong systems demo into a more credible product and engineering artifact.

This phase must address:
- backend modularity
- frontend product quality
- CI/CD foundation
- security posture tightening
- deployment credibility
- test confidence beyond SQLite-only assumptions

This is not a rewrite. This is a structured hardening and productization pass.

==================================================
OBJECTIVE
==================================================

Implement Phase 7 as a focused multi-part improvement pass covering:

1. Backend module decomposition for document logic
2. Frontend product-quality UI/UX pass with deliberate polish
3. CI workflow foundation
4. Deployment / containerization baseline
5. Security posture tightening
6. Better environment/config safety
7. Test strategy improvement toward PostgreSQL realism
8. Incremental Alembic migration only if schema changes are actually required

Do not stop at analysis. Inspect the repository, reconcile to actual file paths, and implement completely.

==================================================
VERY IMPORTANT UI/UX DIRECTION
==================================================

The frontend must start receiving deliberate polish.

This does NOT mean:
- flashy gradients
- generic AI slop
- empty visual dressing
- icons everywhere
- emoji usage
- gimmicky dashboards
- fake enterprise chrome

It DOES mean:
- strong spacing rhythm
- clearer hierarchy
- better grouping of information
- better density decisions
- cleaner typography choices within existing stack
- more intentional states, actions, and layouts
- more professional interaction design
- better component structure
- less scaffold feel, more product feel

Style requirements:
- no emojis
- no gratuitous icons
- no decorative icon packs just to look busy
- no AI-generated feeling labels or filler copy
- keep it serious, product-like, and restrained
- focus on clarity, confidence, and operational usability

The result should feel like a real internal operations product, not a hackathon demo and not a dribbble concept.

==================================================
NON-NEGOTIABLE EXECUTION RULES
==================================================

1. Inspect the repo first.
   - Read the current backend and frontend structure fully.
   - Identify actual files for:
     - document service and related routes
     - record detail page and document/evidence UI
     - frontend API layer and shared types
     - auth/security/config
     - CORS setup
     - tests and fixtures
     - migrations
     - GitHub Actions / CI if present
     - Dockerfile / deployment assets if present
     - README and project docs

2. Preserve the current architecture.
   - Keep FastAPI + SQLAlchemy + local evidence storage
   - Keep Next.js app structure
   - Do not introduce cloud services
   - Do not redesign the entire auth system
   - Do not replace the core workflow engine

3. Prefer modifying existing files.
   - Avoid duplication
   - Extract modules/components where necessary
   - Reuse current patterns unless they are actively harmful

4. Keep correctness ahead of appearance.
   - UI polish must not reduce capability clarity
   - CI must run meaningful checks, not fake green workflows
   - security hardening must not be purely cosmetic

5. Do not half-implement platform features.
   - If you add CI, it must actually run
   - If you add Docker, it must be coherent
   - If you tighten secrets/config, do it correctly
   - If you refactor services/components, remove the old god-file patterns cleanly

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
PHASE 7A — BACKEND MODULARITY
==================================================

Goal:
Reduce god-object risk and improve maintainability.

Known concern:
- `document_service.py` is too large and approaching god-object territory

Required behavior:
Refactor the current document service layer into smaller, coherent modules without changing external behavior unnecessarily.

Preferred split:
- upload / ingest concerns
- verification concerns
- integrity-check concerns
- content delivery resolution concerns
- deletion / cleanup concerns
- summary / reporting concerns

Requirements:
1. Inspect current `document_service.py`
2. Split it into smaller modules under a coherent package structure
3. Keep route layer thin
4. Keep business logic discoverable
5. Avoid circular imports
6. Preserve current tests and route behavior

Preferred outcome:
- `document_service.py` becomes a lightweight orchestration layer or disappears into a package
- no single document module should feel like a new god object

Do not:
- rewrite all route signatures unless necessary
- duplicate helpers across files
- change behavior casually during refactor

==================================================
PHASE 7B — FRONTEND PRODUCTIZATION / UI POLISH
==================================================

Goal:
Move the frontend from scaffold/demo quality toward a credible product surface.

Known concern:
- records detail page is too large and needs extraction
- frontend currently demonstrates capability more than product quality

Required behavior:
Refactor the current record detail page into smaller components and improve the UI/UX in a restrained, serious way.

Minimum required component extraction:
- record header / summary section
- workflow status / stage panel
- evidence summary strip
- document list / document actions section
- upload section
- preview modal
- integrity result display or related interactions

Requirements:
1. Break the large page file into coherent components
2. Improve visual hierarchy
3. Improve spacing and grouping
4. Improve action clarity
5. Make important operational information easier to scan
6. Maintain current capabilities:
   - upload
   - preview
   - download
   - verify
   - integrity check
   - delete
   - evidence summary

UI requirements:
- no emojis
- no gratuitous icons
- no ornamental UI
- no generic AI product language
- no fake analytics tiles
- no noisy gradients or visual clutter
- use typography, spacing, borders, and layout to create polish
- keep the aesthetic calm, operational, and believable

UX requirements:
- action placement should feel intentional
- metadata-only vs upload-backed distinction should remain obvious
- loading, empty, and error states should look deliberate
- modal/dialog interactions should remain accessible
- avoid giant dense walls of UI in one screen region

Do not:
- turn it into a marketing page
- add design fluff without informational value
- remove operational density to the point of hiding useful detail

==================================================
PHASE 7C — CI WORKFLOW FOUNDATION
==================================================

Goal:
Add real CI so the project has an actual engineering story.

Known concern:
- no visible CI/CD is a credibility gap

Required behavior:
Add a GitHub Actions CI workflow that runs meaningful checks.

Minimum CI expectations:
1. Backend:
   - install dependencies
   - run tests
2. Frontend:
   - install dependencies
   - run build
3. If lint/typecheck already exists and is stable:
   - include it
4. Keep workflow reliable and not overly broad

Preferred structure:
- one workflow file, possibly split into backend/frontend jobs
- caching where appropriate
- clear failure visibility

Important:
- CI must actually run the real commands the repo supports
- do not invent commands that do not exist
- if the backend test matrix can support PostgreSQL service containers, strongly consider it

Preferred enhancement:
- if feasible and stable, run backend tests against PostgreSQL in CI
- if full conversion is too risky in one pass, at minimum structure CI so PostgreSQL-backed tests can be added cleanly next

Do not:
- add fake placeholder CI
- add deployment automation unless it is coherent and minimal
- make CI depend on secrets unnecessarily

==================================================
PHASE 7D — DEPLOYMENT / CONTAINERIZATION BASELINE
==================================================

Goal:
Close the conspicuous deployment-story gap.

Known concern:
- no visible Dockerfile or deployment story

Required behavior:
Add a minimal, credible containerization/deployment baseline.

Minimum acceptable outcome:
- backend Dockerfile
- frontend Dockerfile if project structure supports it cleanly
OR
- a clearly documented single-service strategy if only backend containerization is appropriate right now

Requirements:
1. Inspect current app startup and build assumptions
2. Add Dockerfile(s) that are coherent with the actual app
3. Add `.dockerignore` as needed
4. Update README with concise local/container run guidance

Optional but useful:
- `docker-compose.yml` or equivalent local dev composition if it fits current repo without overcomplicating things

Do not:
- fake a production-ready orchestration stack
- add Kubernetes manifests
- add bloated deployment assets with no validation

==================================================
PHASE 7E — SECURITY POSTURE TIGHTENING
==================================================

Goal:
Address the current obvious security gaps.

Known concerns:
- SQLite-only testing
- permissive CORS
- no visible rate limiting
- JWT secret default behavior too forgiving

Required behavior:

1. JWT secret safety
- inspect current config behavior
- if secret currently falls back to a known default in unsafe environments, fix it
- fail loudly in non-dev / non-test contexts if required secret is unset
- keep local dev and tests workable, but do not silently allow unsafe production behavior

2. CORS tightening
- inspect current CORS setup
- reduce permissiveness from `allow_methods=["*"]` and `allow_headers=["*"]` if that is still present
- make the config environment-driven and realistic
- preserve current frontend dev flow

3. Rate limiting
- add a lightweight rate-limiting approach if it can be done coherently
- prioritize sensitive endpoints:
  - auth
  - upload
  - maybe signed content access issuance if appropriate
- if the chosen stack does not already support easy rate limiting, use the smallest credible solution
- do not build a whole distributed rate-limiter architecture

Requirements:
- keep the changes practical
- do not break current development flow
- document important environment expectations

Do not:
- hardcode production origins
- introduce a giant security framework casually
- add fake rate limiting that does nothing real

==================================================
PHASE 7F — TEST STRATEGY IMPROVEMENT
==================================================

Goal:
Reduce confidence gaps caused by SQLite-only coverage.

Known concern:
- PostgreSQL behavior differences are not exercised

Required behavior:
Improve the project’s path toward realistic DB testing.

Acceptable approaches:
1. Add PostgreSQL-backed CI test job if feasible
2. Add a separate test target or fixture path for PostgreSQL-compatible tests
3. Refactor tests/config so PostgreSQL execution becomes straightforward and documented

Requirements:
- do not break current fast local SQLite test loop unless necessary
- preserve fast default tests if that is the current workflow
- improve confidence where feasible
- document what is and is not covered

Do not:
- claim PostgreSQL parity without actually exercising it
- rip out SQLite-only tests if they are still useful for quick feedback

==================================================
PHASE 7G — README / ENGINEERING STORY
==================================================

Goal:
Make the repo tell a more complete and credible story.

Known concern:
- backend is advanced but project story is incomplete without CI/deploy/testing/security context

Required behavior:
Update README and/or docs to include:
- architecture summary
- current capabilities
- local run instructions
- CI overview
- migration workflow
- deployment/container story
- security/config expectations
- testing limitations and current DB coverage truthfully stated

Requirements:
- concise and honest
- no marketing fluff
- no exaggerated claims

==================================================
TESTING REQUIREMENTS
==================================================

Extend the current test suite as needed.

At minimum add/update tests for:
1. refactored document-service boundaries still preserve behavior
2. frontend extraction does not break current flows
3. CI commands used in workflow are valid
4. tightened config/secret behavior works correctly by environment
5. CORS config remains functional but less permissive
6. any rate limiting added is actually enforced
7. PostgreSQL-oriented test path or CI path works if implemented
8. Docker/container files are coherent at least structurally

Use existing test patterns where possible.
Do not create a new framework unless absolutely necessary.

==================================================
IMPLEMENTATION DISCOVERY STEPS
==================================================

Before editing:
1. Read current backend files for:
   - document service and related modules
   - config
   - security
   - CORS setup
   - main startup
   - tests
   - migrations
2. Read current frontend files for:
   - record detail page
   - API client
   - shared types
   - evidence UI pieces
3. Determine current role/auth model
4. Determine existing npm/python scripts and valid CI commands
5. Determine whether Docker assets already exist in any form
6. Determine current README state

Then implement the changes.

==================================================
ACCEPTANCE CRITERIA
==================================================

- document service is materially less monolithic
- record detail page is componentized and more product-like
- frontend polish improves clarity without generic AI slop
- CI workflow exists and runs meaningful checks
- deployment/container story is materially improved
- JWT secret behavior is safer
- CORS is tighter and environment-driven
- some real rate-limiting protection exists or a clearly justified minimal alternative is implemented
- PostgreSQL confidence is improved or the path is concretely established
- README/project docs tell a credible engineering story
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
