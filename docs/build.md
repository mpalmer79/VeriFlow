You are acting as a staff-level full-stack engineer performing Phase 11 refinement and trust-hardening on an existing FastAPI + SQLAlchemy + PostgreSQL + Next.js 14 project named VeriFlow.

Phase 1 through Phase 10 already landed. The project now has:
- strong workflow, audit, and evidence lifecycle foundations
- signed content access
- preview/download flows
- evidence cleanup and integrity tooling
- CI with SQLite + PostgreSQL split
- Dockerfiles and Railway groundwork
- modular backend services
- operations/admin UI surface
- Playwright groundwork plus a few real tests
- restrained typography system using next/font/google
- Inter + JetBrains Mono
- tabular numerals and mono utilities
- controlled motion and reduced-motion support
- dramatically improved backend test runtime

Phase 11 is about:
- tightening the remaining trust/security edges
- making the frontend feel more finished under real use
- increasing confidence in key user flows
- improving the admin/operations experience
- sharpening the repo and product story for serious review

This is not a rewrite. This is a focused refinement and trust-hardening pass.

==================================================
OBJECTIVE
==================================================

Implement Phase 11 covering:

1. Signed-content access tightening
2. Playwright CI strategy and selective browser confidence
3. Frontend visual QA and high-value refinement
4. Admin/operations usability polish
5. Product/readme/portfolio presentation cleanup
6. Incremental Alembic migration only if schema changes are actually required

Do not stop at analysis. Inspect the repository, reconcile to actual file paths, and implement completely.

==================================================
UI/UX DIRECTION
==================================================

The UI must continue to feel:
- clean
- technical
- modern
- calm
- operationally credible

DO NOT:
- add generic AI slop
- add emojis
- add decorative gradients
- add gratuitous icons
- create fake KPI dashboards
- overanimate the experience

DO:
- improve hierarchy
- improve spacing rhythm
- improve information grouping
- improve state clarity
- improve interaction confidence
- improve readability under dense operational data

Typography direction remains:
- Inter for UI
- JetBrains Mono or existing mono choice for hashes, IDs, rule codes
- tabular numerals on all aligned numeric UI

Motion direction remains:
- subtle
- purposeful
- low-noise
- reduced-motion respected

==================================================
NON-NEGOTIABLE EXECUTION RULES
==================================================

1. Inspect the repo first.
   - Read the current backend and frontend structure fully.
   - Identify actual files for:
     - signed content routes and token logic
     - auth/security/config
     - operations/admin UI
     - record detail page and child components
     - Playwright config and current specs
     - CI workflow
     - README/docs
     - deployment docs
     - migrations

2. Preserve the current architecture.
   - Keep FastAPI + SQLAlchemy + local evidence storage
   - Keep Next.js app structure
   - Keep the current CI split unless a targeted improvement is justified
   - Do not redesign auth architecture wholesale
   - Do not replace the storage model
   - Do not add cloud providers or major infra changes

3. Prefer modifying existing files.
   - Avoid duplication
   - Reuse the typography/motion system already introduced
   - Extend the current test structure rather than creating a second system

4. Keep trust and correctness ahead of appearance.
   - Security tightening must be real
   - Playwright CI must be scoped and credible
   - UI polish must improve usability, not just visuals

5. Do not overbuild.
   - no giant browser test matrix
   - no giant admin console
   - no design-system rewrite
   - no fake enterprise security theater

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
OUTPUT REQUIREMENT
----------------------------------------

If ANY schema change is made, include:
- migration filename
- what it changes
- confirmation baseline not modified

If NO schema change:
→ explicitly say: "No new migration required"

==================================================
PHASE 11A — SIGNED ACCESS TIGHTENING
==================================================

Goal:
Tighten the remaining trust gap around signed content access.

Known current limitation:
- signed content-access tokens can be replayed until expiry

Required behavior:
Inspect the current signed-access implementation and strengthen it in the smallest credible way.

Preferred improvements:
1. Add stronger claim scoping if missing:
   - document id
   - organization id
   - disposition
   - token type
2. Reduce accidental misuse surface
3. If feasible without overengineering, add one of:
   - jti tracking with short-lived in-memory replay prevention
   - one-time-use token tracking in a small bounded store
   - stricter nonce validation path
4. Preserve short TTL behavior
5. Ensure metadata-only docs still cannot obtain signed content access

Requirements:
- do not create a giant distributed token store
- do not weaken current behavior
- do not introduce brittle global state
- if replay prevention is only partial within current architecture, implement the best bounded improvement and document the limitation honestly

Also review:
- signed access error responses
- expired token behavior
- invalid disposition handling
- whether preview/download semantics remain clear

==================================================
PHASE 11B — PLAYWRIGHT CI STRATEGY
==================================================

Goal:
Promote frontend browser confidence carefully without blowing up runtime.

Current state:
- Playwright groundwork exists
- some specs exist
- browser tests are not yet part of the main CI trust story

Required behavior:
Design and implement a small, credible Playwright CI strategy.

Preferred approach:
1. Keep the main CI fast
2. Add one of:
   - a lightweight Playwright smoke job on PRs
   - a narrower manual/nightly/browser job
   - a conditional browser job that runs only when frontend files change, if that is feasible and maintainable
3. Keep the test count small and meaningful

Required test coverage:
- at least one real record-detail/browser flow
- at least one confirm-dialog or modal flow
- at least one admin/operations visibility flow if practical

Requirements:
- do not add a big flaky browser suite
- do not double the CI runtime
- do not pretend browser confidence is broad if it is still narrow
- document clearly what browser coverage actually exists

At the end, explain:
- whether Playwright now runs in CI
- when it runs
- what it covers
- why that scope is appropriate

==================================================
PHASE 11C — FRONTEND VISUAL QA / REFINEMENT
==================================================

Goal:
Apply one more pass of high-value UI refinement where the frontend still feels slightly assembled rather than fully designed.

Required behavior:
Inspect the current record-detail experience and operations/admin surface and improve the weakest remaining areas.

Focus on:
1. section spacing and grouping
2. action hierarchy
3. loading / empty / failure states
4. readability of dense tables/rows
5. admin/operations clarity
6. consistency of typography utilities
7. consistency of motion across dialogs/overlays/panels

Specific quality checks:
- numeric alignment should be consistent anywhere values stack vertically
- mono usage should be consistent and restrained
- motion should not feel random across components
- no section should feel visually “unfinished”
- no admin area should feel like a raw debug dump if it is now user-visible

Do not:
- add fluff
- redesign from scratch
- add gratuitous icons
- add visual noise

==================================================
PHASE 11D — ADMIN / OPERATIONS USABILITY POLISH
==================================================

Goal:
Make the operations surface more credible for real use.

Required behavior:
Refine the existing admin/operations UI so it better supports actual operator workflows.

Focus on:
- audit verification results
- storage inventory readability
- cleanup dry-run vs destructive action clarity
- status/result presentation
- safe action messaging

If useful and consistent with current scope, add:
- clearer result summaries
- better grouping of destructive vs read-only operations
- stronger confirm copy
- better empty/error states

Do not:
- build a huge admin dashboard
- expose unsafe operational detail casually
- add charts just to look impressive

==================================================
PHASE 11E — README / PRODUCT STORY REFINEMENT
==================================================

Goal:
Sharpen how the repo presents itself to serious engineers and recruiters.

Required behavior:
Refine README and relevant docs so they better communicate:
- what the product actually does
- where the strongest engineering work is
- how the evidence/integrity model works
- what CI/test confidence exists
- what deployment story exists
- what limitations remain honestly

Also improve:
- terminology consistency
- wording precision
- project framing

Desired framing:
VeriFlow should read like a serious workflow and evidence-control platform for compliance-heavy operations, not a classroom app and not a vague AI tool.

Do not:
- add marketing fluff
- exaggerate production readiness
- hide important limitations

==================================================
PHASE 11F — OPTIONAL SMALL QUALITY-OF-LIFE IMPROVEMENTS
==================================================

Goal:
If there is time and scope after the core work, land one or two small high-value improvements only if they fit cleanly.

Acceptable examples:
- clearer runtime/ops badges or labels in admin surface
- tighter content access feedback
- small route or helper cleanup that improves clarity
- minor CI warning cleanup if still present

Do not:
- expand scope substantially
- start a new architecture phase
- add novelty features

==================================================
TESTING REQUIREMENTS
==================================================

Extend the test suite as needed.

At minimum add/update tests for:
1. tightened signed-access behavior
2. replay-prevention or improved token-boundary behavior if implemented
3. Playwright CI path or CI workflow assumptions
4. the refined admin/operations UI behavior where testable
5. any frontend interaction changes introduced
6. docs/config assumptions reflected in code where practical

Use existing patterns where possible.
Do not create a giant new framework.

==================================================
IMPLEMENTATION DISCOVERY STEPS
==================================================

Before editing:
1. Read current signed-access backend code and identify its remaining trust gaps
2. Read current Playwright config, specs, and CI workflow
3. Read current frontend record-detail and operations/admin components
4. Read README and deployment docs for wording and framing gaps
5. Determine whether any CI warnings or browser-runner assumptions need cleanup

Then implement the changes.

==================================================
ACCEPTANCE CRITERIA
==================================================

- signed access is tighter and less replay-friendly than before
- Playwright has a credible CI role or clearly scoped execution path
- frontend feels more finished and consistent
- operations/admin UI is more deliberate and usable
- docs communicate the project more sharply and honestly
- no generic AI slop appears in the UI or docs
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
7. If Playwright was added to CI, explain runtime impact and why it is acceptable

Now begin by inspecting the repository and identifying exact files to modify.
