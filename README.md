# VeriFlow

VeriFlow is a workflow intelligence platform. It enforces process
compliance, detects operational risk, and explains — in plain language —
why a record is blocked, warned, or ready to proceed.

It is **not** an EHR, scheduling system, or CRM. VeriFlow tracks records
as they move through controlled workflow stages and evaluates each
transition against rules that determine whether progression is allowed,
what risk has accumulated, and what the user must resolve next. The
first reference scenario is a healthcare intake and compliance
workflow; the engine is domain-agnostic and designed to host loan
intake, vendor onboarding, claims triage, and similar workflows.

## Architecture at a glance

- **Backend.** FastAPI + SQLAlchemy 2.x on PostgreSQL (SQLite for local
  tests). Code-driven rule registry, risk scoring, stage-gated
  transitions, tamper-evident audit chain (SHA-256 per row, chained by
  `previous_hash`), optimistic concurrency via `version` on records,
  a local evidence store with real content hashing at ingest and
  re-hashing at verification, and liveness (`/health`) + readiness
  (`/health/readiness` with a live DB ping) probes for hosted deploys.
- **Frontend.** Next.js 14 + TypeScript + Tailwind. The record detail
  page is componentized into focused pieces (header, action bar,
  evaluation panel, workflow timeline, evidence panel with upload +
  preview + integrity check + download + delete, audit trail, preview
  modal with accessible dialog semantics). Destructive confirmations
  use a shared in-app `ConfirmDialog` rather than native browser
  dialogs, and admins get an `/operations` console for audit-chain
  verification, managed-storage inventory, and bounded orphan cleanup.
- **Evidence.** Real streaming upload writes straight to a server-
  controlled storage root with chunked SHA-256; verification re-reads
  and re-hashes those bytes; content delivery supports HTTP `Range`
  and short-lived signed URLs so browsers load preview/download
  directly without prefetching the full blob.
- **Security.** JWT with explicit `iss` / `aud` / `typ` / `jti`;
  separate audience for short-lived content-access tokens; app-wide
  security headers and a tight CSP; environment-driven CORS; role-
  gated admin/debug routes; in-memory sliding-window rate limiter on
  auth, upload, and signed-access issuance.

## Capabilities

- Controlled multi-stage workflows with explicit terminal states
- Code-driven rule registry evaluated per record at the appropriate
  stage context
- Risk scoring with a banded classification (`low` / `moderate` /
  `high` / `critical`)
- Document evidence with real server-computed content hashes and
  verification-time re-hashing; metadata-only documents are
  distinguished from upload-backed evidence throughout the UI and API
- Stage-gated transitions that block on failing rules and explain the
  reason
- Append-only audit log with canonical, structured payloads and a
  verifiable hash chain

## Example: healthcare intake

A record represents a prospective patient progressing through a
nine-stage workflow:

1. **New Intake** — record created, basic identifying details captured
2. **Identity Verification** — government ID and demographic checks
3. **Insurance Review** — coverage verified, pending, or self-pay
4. **Consent & Authorization** — required forms signed and current
5. **Clinical History Review** — intake forms complete and reviewed
6. **Provider Triage** — clinical handoff to the appropriate provider
7. **Ready for Scheduling** — all checks passed; eligible to schedule
8. **Blocked** — one or more rules failed; resolution required
9. **Closed** — terminal disposition for the record

The scenario is illustrative only. No PHI handling, HIPAA controls, or
clinical decision support are implied.

## Repository layout

```
.
├── ARCHITECTURE.md
├── README.md
├── docker-compose.yml          Local Postgres + backend + frontend
├── .github/workflows/ci.yml    Backend (sqlite + postgres) + frontend CI
├── backend/
│   ├── Dockerfile
│   ├── alembic.ini             Alembic config
│   ├── migrations/             Incremental migrations (baseline locked)
│   ├── app/
│   │   ├── api/routes/         Thin HTTP routes
│   │   ├── core/               config, database, security, evidence_storage, rate_limit
│   │   ├── models/             SQLAlchemy 2.x models + enums
│   │   ├── repositories/       data access
│   │   ├── schemas/            Pydantic request/response shapes
│   │   ├── services/
│   │   │   ├── document_service/   Package: ingest / verification /
│   │   │   │                       content / cleanup / summary
│   │   │   ├── audit_service.py    Chained audit writer + verify_chain
│   │   │   ├── workflow_service.py Transition enforcement
│   │   │   └── …
│   │   └── seed/               Idempotent demo data
│   └── tests/                  pytest suite (SQLite by default,
│                               Postgres when TEST_DATABASE_URL is set)
├── frontend/
│   ├── Dockerfile
│   ├── app/                    Next.js app-router pages
│   ├── components/             Shared + record-detail component split
│   └── lib/                    api.ts, types.ts, auth, format
└── docs/
```

## Running locally

### With Docker Compose (recommended)

```bash
docker compose up --build
```

This starts Postgres, applies Alembic migrations, runs the idempotent
seed, and serves the backend on `:8000` and the frontend on `:3000`.

### Native

Backend:

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env

# Apply migrations (production) or skip to the seed (local demo):
alembic upgrade head

python -m app.seed.seed_data
uvicorn app.main:app --reload --port 8000
```

- Interactive API docs: <http://localhost:8000/docs>
- Liveness check: <http://localhost:8000/health>
- Readiness check (DB ping): <http://localhost:8000/health/readiness>

Frontend:

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

## Local demo access

The seed script provisions four local demo accounts — one per role —
so the API can be exercised end-to-end without configuring an identity
provider. These credentials exist **only** in local seeded databases
and are not valid against any hosted environment.

| Role                  | Email                     |
|-----------------------|---------------------------|
| `admin`               | `admin@veriflow.demo`     |
| `intake_coordinator`  | `intake@veriflow.demo`    |
| `reviewer`            | `reviewer@veriflow.demo`  |
| `manager`             | `manager@veriflow.demo`   |

The shared demo password lives in
`backend/app/seed/seed_data.py::DEFAULT_PASSWORD`. Change it before
running the seed in any shared environment.

## Configuration

Key environment variables (see `backend/.env.example` for the full
list):

| Variable | Purpose |
|----------|---------|
| `APP_ENV` | `development` / `test` / `production`. Startup refuses to run in any non-dev env while `JWT_SECRET` is still the default. |
| `JWT_SECRET` | HMAC secret for access and content-access tokens. |
| `JWT_ISSUER` / `JWT_AUDIENCE` | Identify this deployment in minted tokens. |
| `DATABASE_URL` | Production is PostgreSQL; local/tests default to SQLite. |
| `CORS_ORIGINS` | Comma-separated origin allowlist (default `http://localhost:3000`). |
| `CORS_ALLOW_METHODS` / `CORS_ALLOW_HEADERS` | Tight defaults; override with care. |
| `EVIDENCE_STORAGE_DIR` | Managed local storage root for uploaded bytes. |
| `MAX_UPLOAD_BYTES` | Per-file cap enforced during streaming ingest. |
| `CONTENT_ACCESS_TTL_SECONDS` | Short-lived signed-URL expiry. |
| `RATE_LIMIT_LOGIN_PER_MINUTE` / `..._UPLOAD_PER_MINUTE` / `..._SIGNED_ACCESS_PER_MINUTE` | Per-IP or per-user sliding-window budgets. |

## CI

`.github/workflows/ci.yml` runs on every push and pull request:

- **`backend-sqlite`** — installs backend deps and runs the full pytest
  suite against in-memory SQLite (the fast default).
- **`backend-postgres`** — spins up a `postgres:16` service container,
  runs `alembic upgrade head` against it, and executes the same pytest
  suite with `TEST_DATABASE_URL` pointing at Postgres. This catches
  dialect-specific issues (partial unique indexes, JSONB, enum
  conversions) that SQLite can hide.
- **`frontend`** — `npm ci`, `npm run type-check`, `npm run build`.

## Migrations

Alembic lives in `backend/migrations/`. The baseline
`0001_initial_schema.py` is **locked**; every schema change must be a
new incremental revision. Day-to-day:

```bash
cd backend
alembic upgrade head                  # apply all migrations
alembic revision -m "add <thing>"     # new empty revision
alembic revision --autogenerate -m "…"
alembic downgrade -1                  # roll back one revision
alembic stamp head                    # mark an existing DB as migrated
```

See `docs/migrations.md` for the baseline strategy.

## Testing

```bash
cd backend
pytest                                # SQLite default
TEST_DATABASE_URL=postgresql+psycopg2://… pytest
```

The SQLite default keeps the local loop fast; the PostgreSQL path is
wired for CI and can be run locally by exporting
`TEST_DATABASE_URL`. Every test resets the schema, the evidence
storage tempdir, and the rate-limit buckets to avoid state bleed.

## Security posture

- Startup **fails loudly** in non-dev environments if `JWT_SECRET` is
  still the default.
- JWTs use explicit `iss` / `aud` / `typ` / `jti`. Access tokens use
  `aud=veriflow-api`; short-lived content-access tokens use
  `aud=veriflow-content` and cannot cross over.
- CORS is environment-driven: explicit methods / headers rather than
  `["*"]`, and `expose_headers` is narrow.
- App-wide middleware sets `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: no-referrer`, `Permissions-Policy`, and a
  restrictive Content-Security-Policy
  (`default-src 'none'; frame-ancestors 'self' <cors origins>`).
  Interactive docs routes are exempted so Swagger / ReDoc still load.
- Admin/debug routes (`/api/audit/verify`,
  `/api/audit/storage-inventory`, `/api/audit/storage-cleanup`)
  require the `admin` role.
- Rate limits on `/api/auth/login`, `/api/records/{id}/documents/upload`,
  and `/api/documents/{id}/signed-access`. Sliding-window, in-process;
  swap for Redis-backed if you run multiple replicas.

## Engineering story so far

- **Phases 0–1** — monorepo, data model, auth, record CRUD.
- **Phase 2** — rule registry, risk scoring, evaluation, transitions.
- **Phase 3** — documents as first-class evidence, required-document
  logic, stage-aware rule filtering, canonical audit payloads.
- **Hardening rounds** — optimistic concurrency, audit hash chain,
  document integrity metadata, real upload + verification + integrity
  check + record-level cleanup + secure content delivery + range
  support + evidence preview + signed URLs + orphan sweep.
- **Phase 7** — backend modularity (document service
  split), frontend componentization and polish, CI workflow with
  PostgreSQL matrix, Dockerfiles + Compose, JWT-secret and CORS
  tightening, rate limiting, and a PostgreSQL test path.
- **Phase 8 (this pass)** — productization and deployment readiness:
  shared in-app `ConfirmDialog` replacing native `window.confirm` /
  `window.prompt`, admin-gated `/operations` UI for audit-chain
  verification and storage inventory + orphan cleanup, dev-only seed
  gating with an explicit opt-in override, readiness endpoint with a
  live DB ping, Railway configuration for both services, deployment
  docs, and Playwright groundwork.

## Known limitations

- **Rate limiter is in-process.** Fine for a single-replica deployment
  but does not share state across instances. Swap for Redis-backed
  `limits.storage.RedisStorage` (or similar) for horizontal scaling.
- **Evidence storage is local only.** No S3 / GCS. The storage
  interface is small enough that a cloud-backed implementation can
  live behind `evidence_storage` without schema changes.
- **Frontend tests are scaffolded, not exhaustive.** A minimal
  Playwright harness lives under `frontend/tests/e2e/`; run it against
  a running stack via `npm run test:e2e`. Type-check and Next build
  are still the primary CI guardrails.
- **Signed content-access tokens can be replayed** until they expire
  (default 120s). A `jti` denylist would make them strict one-shot.
- **Alembic runs at start-up** in both the local compose stack and
  hosted deployments (see `docs/deployment.md`). There is no separate
  release phase — risky schema changes should ship as a two-step
  deploy so the running revision tolerates both schemas.

## References

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — system design and service boundaries
- [`docs/workflow_rules.md`](./docs/workflow_rules.md) — stages, rule catalogue, evaluation semantics
- [`docs/document_evidence.md`](./docs/document_evidence.md) — document model and hybrid rule contract
- [`docs/product_overview.md`](./docs/product_overview.md) — problem framing and product capabilities
- [`docs/migrations.md`](./docs/migrations.md) — Alembic layout and evolution strategy
- [`docs/deployment.md`](./docs/deployment.md) — Railway deployment wiring and release workflow
