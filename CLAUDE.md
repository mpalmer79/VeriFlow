# VeriFlow — working notes for Claude sessions

Persistent context for any Claude session working in this repository.
Describes invariants, how to run things, known landmines, working
conventions, and what is explicitly out of scope. Does not describe
current open work, active PR topics, or specific-screen layout —
those change, this file should not.

## What this project is

VeriFlow is a workflow and evidence-control platform. Backend: FastAPI
on SQLAlchemy 2.x against PostgreSQL (SQLite under local tests).
Frontend: Next.js 14 + TypeScript + Tailwind with Framer Motion as the
single motion primitive. Both services deploy on Railway. See
README.md for capabilities and local setup; ARCHITECTURE.md for system
design and service boundaries. This is currently a portfolio project;
active workstreams focus on frontend polish for recruiter and
hiring-manager reviewers. Backend feature work is on hold unless a
frontend change specifically blocks on it.

## Invariants

- Strict layering. Routes call services; services call
  repositories; repositories touch the ORM. No SQL in routes.
- Request schemas forbid extras via
  `model_config = ConfigDict(extra="forbid")`. Unknown fields
  produce 422.
- Service exceptions translate at the route layer. No bare 500s.
  Each service exception type maps to a specific HTTP status.
- Audit chain semantics are not to be worked around. Every domain
  event writes through `audit_service`. The `entry_hash` /
  `previous_hash` chain is the product's tamper-evidence claim.
- Evidence storage is server-controlled. Uploads stream through
  `app.core.evidence_storage` with chunked SHA-256. Client-trusted
  hashes are not accepted.
- Optimistic concurrency via `record.version`. Mutating a record
  requires `expected_version` in the request; a mismatch returns
  409.
- Alembic baseline is locked. Schema changes ship as new
  incremental revisions, never by editing `0001_baseline.py`.

## How to run things

Backend tests (SQLite, fast loop):

    cd backend && pytest -m "not postgres"

Backend tests (PostgreSQL subset):

    cd backend && TEST_DATABASE_URL=postgresql+psycopg2://… \
        pytest -m "postgres or migration"

Frontend type-check and build:

    cd frontend && npm run type-check
    cd frontend && npm run build

Frontend end-to-end (requires backend + frontend running):

    cd frontend && npm run test:e2e:install
    cd frontend && npm run test:e2e

Full local stack:

    docker compose up --build

Seed demo data:

    cd backend && python -m app.seed.seed_data

## Working conventions

- Scope PRs tightly. Two files per commit, one commit per PR, is
  the working default. Larger scope requires surfacing the reason
  in the PR description.
- No drive-by refactors. Unrelated issues in a file you are
  editing become a followup issue or PR, not an inline fix.
- No new dependencies without asking. If a change seems to need a
  new package, surface it before adding.
- Comments explain why, not what. Self-evident code does not get
  comments. Comments exist for non-obvious decisions, tradeoffs,
  and warnings to future readers.
- Tests pin contracts. Changing a contract means updating the test
  that pins it. Never disable a test to make a PR green.
- Never claim "A+", "perfect", or other superlatives in committed
  documentation. Describe the work precisely.

## Landmines

- `app.services.audit_service` — the chained hash is
  order-sensitive. Changing how canonical payloads are built
  breaks `verify` for every record written after the change.
- `app.core.content_access` — the jti replay guard is
  single-node, in-memory. Multi-replica deployments would need a
  shared store.
- `app.core.rate_limit` — same single-node constraint.
- `EVIDENCE_STORAGE_DIR` must resolve to a writable, server-controlled
  path. Never default it to anything user-controllable.
- `JWT_SECRET` — startup refuses to run in non-dev environments
  while the default is in place. Do not weaken this.
- Framer Motion — every motion call site must honor
  `useReducedMotion`, either directly or via a preset from
  `lib/motion.ts`.

## Out of scope

- S3 or GCS evidence storage backends.
- Redis-backed rate limiting or jti guard.
- Multi-replica deployment topology.
- Firefox or WebKit Playwright coverage in CI.
- Backfilling any historical data.
- New authentication providers beyond the existing JWT flow.
- Analytics, telemetry, or usage tracking.

If a change seems to require one of these, stop and surface it as
a conversation, not a PR.

## Where to look next

- README.md — capabilities, running locally, CI structure,
  security posture, known limitations.
- ARCHITECTURE.md — system design and service boundaries.
- CHANGELOG.md — what landed when.
- docs/build_history.md — the original multi-phase build prompt
  that produced the current state. Historical only.
- docs/workflow_rules.md — rule catalogue and evaluation
  semantics.
- docs/document_evidence.md — document model and hybrid rule
  contract.
- docs/deployment.md — Railway deployment wiring.
