You are acting as a staff-level full-stack engineer performing Phase 10 optimization and frontend product refinement on an existing FastAPI + SQLAlchemy + PostgreSQL + Next.js 14 project named VeriFlow.

Phase 1 through Phase 9 already landed. The project now has:
- strong workflow, audit, and evidence lifecycle foundations
- document integrity and storage handling
- CI with optimized SQLite/PostgreSQL split
- Dockerfiles and Railway groundwork
- modular backend services
- operations/admin UI surface
- Playwright scaffolding
- structured frontend components

Phase 10 is about:
- reducing backend test runtime (primary bottleneck)
- elevating frontend into a polished product surface
- introducing disciplined typography and layout system
- adding motion/animation in a controlled, professional way
- improving frontend interaction confidence
- tightening deployment credibility

This is NOT a rewrite. This is a precision refinement phase.

==================================================
OBJECTIVE
==================================================

Implement Phase 10 covering:

1. Backend test runtime reduction (highest priority)
2. Frontend typography system (Inter + tabular numerals + mono)
3. Controlled motion/animation system
4. High-value UI/UX refinement (no AI slop)
5. Playwright follow-through (minimal but meaningful)
6. CI/runtime alignment with new test structure
7. Deployment clarity (Railway + Docker positioning)

==================================================
CRITICAL UI/UX PRINCIPLES
==================================================

The UI must feel:
- clean
- technical
- modern
- deliberate
- high signal, low noise

DO NOT:
- use emojis
- add decorative icons everywhere
- use gradients or flashy effects
- create dashboard fluff
- generate generic AI UI copy

DO:
- use spacing, alignment, and typography to create hierarchy
- keep density appropriate for an operations tool
- make actions clear and intentional
- improve clarity over decoration

Target inspiration:
- Linear
- Stripe dashboards
- modern internal tooling

==================================================
PHASE 10A — BACKEND TEST RUNTIME OPTIMIZATION
==================================================

Goal:
Reduce the SQLite broad suite runtime significantly.

Current issue:
- heavy per-test setup in conftest
- repeated drop_all/create_all
- reseeding on every test

Required actions:
1. Audit backend/tests/conftest.py
2. Reduce full schema resets where not required
3. Introduce smarter fixture scoping:
   - session or module where safe
4. Split tests into:
   - requires_full_reset
   - lightweight tests
5. Avoid reseeding entire dataset per test unless required
6. Ensure test isolation is preserved

Optional:
- evaluate pytest-xdist ONLY if suite becomes worker-safe

Do NOT:
- remove meaningful tests
- break isolation for speed

==================================================
PHASE 10B — TYPOGRAPHY SYSTEM (MANDATORY)
==================================================

Goal:
Introduce a professional typography system.

Required implementation:

1. Use Next.js 14 font system:
   - next/font/google

2. Primary font:
   - Inter

3. Monospace font:
   - JetBrains Mono OR IBM Plex Mono

4. Apply tabular numerals:
   - font-variant-numeric: tabular-nums

Apply tabular numerals to:
- risk scores
- versions
- timestamps
- file sizes
- numeric table columns
- counts and metrics

Apply monospace to:
- document hashes
- audit IDs
- rule codes
- correlation IDs

Create reusable utilities or classes for:
- tabular numeric alignment
- mono text usage

Ensure:
- zero layout shift from fonts
- no external font requests

==================================================
PHASE 10C — MOTION / ANIMATION SYSTEM
==================================================

Goal:
Introduce motion that enhances UX without becoming distracting.

This must be subtle, intentional, and product-grade.

DO NOT:
- add flashy animations
- animate everything
- create gimmicky transitions

DO:
- use motion to reinforce state changes
- improve perceived performance
- guide user attention

Required implementations:

1. Initial page entry animation
   - when user first lands on homepage
   - ~2 seconds total duration
   - smooth fade + slight vertical motion
   - must not block interaction

2. Component-level motion
   Apply subtle motion to:
   - section transitions
   - modal open/close (preview, confirm dialog)
   - table row updates
   - loading-to-loaded transitions
   - admin panel sections

3. Interaction feedback
   - hover states (subtle)
   - button press feedback
   - success/failure transitions

4. Loading transitions
   - replace abrupt content swaps with smooth transitions
   - skeleton or fade-in patterns where appropriate

Implementation guidance:
- use a lightweight library (e.g., framer-motion) OR CSS transitions
- keep durations short (150–300ms typical, except initial load)
- maintain performance

==================================================
PHASE 10D — FRONTEND PRODUCT POLISH
==================================================

Target areas:
- record detail page
- operations/admin page
- document evidence panel
- tables and lists

Improve:
1. alignment and spacing
2. numeric column readability
3. action grouping
4. section hierarchy
5. loading and empty states
6. confirmation flows
7. error messaging clarity

Ensure:
- metadata-only vs upload-backed states are obvious
- admin actions are clearly separated from user actions

==================================================
PHASE 10E — PLAYWRIGHT FOLLOW-THROUGH
==================================================

Goal:
Add minimal but meaningful frontend confidence.

Add tests for:
1. record detail page renders
2. preview modal opens/closes
3. metadata-only gating works
4. operations page renders correctly
5. confirm dialog behavior

Keep:
- test count small
- tests stable

Do NOT:
- create a large flaky suite

==================================================
PHASE 10F — CI ALIGNMENT
==================================================

Goal:
Ensure CI reflects optimized test structure.

Verify:
- SQLite runs broad fast suite
- PostgreSQL runs targeted subset
- no duplication reintroduced

Do NOT:
- increase CI runtime unnecessarily
- add heavy frontend test jobs unless lightweight

==================================================
PHASE 10G — DEPLOYMENT CLARITY
==================================================

Goal:
Make deployment story explicit and honest.

Required:
- clarify Railway vs Docker usage
- document:
  - env variables
  - migrations
  - startup commands
  - storage limitations
- ensure seed logic is dev-only

Positioning:
- Dockerfiles remain for consistency and portability
- Railway is primary deployment path

Do NOT:
- imply production-grade infra beyond reality
- hide limitations

==================================================
ACCEPTANCE CRITERIA
==================================================

- backend SQLite suite runtime reduced
- UI feels more polished and intentional
- typography system is consistent
- numeric alignment is visibly improved
- motion enhances UX without distraction
- Playwright tests cover real flows
- CI remains efficient
- deployment story is clear and honest

==================================================
OUTPUT FORMAT
==================================================

Provide:

1. Summary
2. Files modified
3. Files added
4. Migration files
5. Tests added/updated
6. Remaining limitations
7. Expected CI runtime improvement

Now begin by inspecting the repository and implementing Phase 10.
