# Deployment

VeriFlow ships as two services (FastAPI backend + Next.js frontend) and a
PostgreSQL database. This document describes the concrete wiring for
Railway, which is the primary hosted target, and calls out the pieces
that generalize to any platform that can run Dockerfiles.

## Services

- **backend** — `backend/Dockerfile`, exposes `:8000`.
  Runs `alembic upgrade head` before starting uvicorn, so every deploy
  reconciles the schema against `migrations/versions/`.
- **frontend** — `frontend/Dockerfile`, exposes `:3000`. Pure `next start`
  against the compiled output baked at build time.
- **Postgres 16** — any managed instance is fine. The backend
  connects via `DATABASE_URL`.

## Railway wiring

A [`railway.json`](../backend/railway.json) lives next to each service's
Dockerfile. Railway picks them up automatically when each service's
root directory is set to `backend/` or `frontend/` respectively.

### Backend service

Required environment variables:

| Variable | Value | Notes |
| --- | --- | --- |
| `APP_ENV` | `production` | Disables the demo seed and refuses default JWT secrets. |
| `JWT_SECRET` | random 32+ bytes | `openssl rand -hex 32` is fine. |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | Reference the attached Postgres plugin. |
| `CORS_ORIGINS` | frontend public URL | Comma-separated; include the Railway-assigned HTTPS host. |
| `EVIDENCE_STORAGE_DIR` | `/var/lib/veriflow/evidence` | Mount a Railway volume here so uploads survive redeploys. |

Optional:

- `MAX_UPLOAD_BYTES` — override the 25 MiB default cap.
- `RATE_LIMIT_*_PER_MINUTE` — loosen or tighten per-bucket limits.
- `VERIFLOW_ALLOW_SEED` — **do not set** in production. Only used in
  staging if you want the demo org materialized once after a fresh DB.

The Railway config declares `/health/readiness` as the healthcheck path.
That endpoint returns `200` only after the DB is reachable, so Railway
will hold traffic off the node until migrations succeed.

### Frontend service

Required environment variables:

| Variable | Value | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | backend public URL + `/api` | Baked into the client bundle at build time; rebuild on change. |

### Postgres plugin

Attach Railway's built-in Postgres 16 plugin. No schema bootstrap is
required — the backend runs Alembic on every start, and the baseline
migration (`0001_initial_schema.py`) creates all tables.

## Evidence storage

Railway's ephemeral filesystem is not a safe place to keep uploaded
evidence between deploys. Either:

1. Attach a Railway volume at `/var/lib/veriflow/evidence` and point
   `EVIDENCE_STORAGE_DIR` at it. This is the simplest option and what
   the provided `railway.json` assumes.
2. Swap `evidence_storage` for an S3-backed implementation. The module
   boundary in `backend/app/services/evidence_storage.py` is designed
   for this — it already abstracts store/read/delete behind a stable
   interface.

## Release migrations

Migrations run in the container's start command, before uvicorn binds
the port. Readiness returns `503` until both the start command reaches
uvicorn and the DB ping succeeds, so Railway keeps the previous
revision serving traffic if Alembic fails.

If a migration is risky enough that you'd rather gate it behind a
manual step, split the deploy into two:

1. First deploy: ship the migration with code that tolerates both
   schemas (current and post-migration).
2. Second deploy: remove the compatibility shims.

## Local parity

`docker compose up --build` from the repo root brings up the same
three-service topology against a local Postgres. The backend's compose
command additionally runs the demo seed, which only succeeds because
`APP_ENV=development` is set on the service definition.
