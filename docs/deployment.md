# Deployment

VeriFlow ships as two services (FastAPI backend + Next.js frontend) and
a PostgreSQL database. This document describes the concrete wiring for
Railway, which is the primary hosted target, and calls out the pieces
that generalize to any platform that can run Dockerfiles.

## Railway vs Docker

Both exist on purpose and answer different questions:

- **Railway** is the primary hosted path. Each service has a
  `railway.json` next to its `Dockerfile`; Railway uses the Dockerfile
  builder and executes the `deploy.startCommand` defined in the config.
  Migrations run automatically on every backend deploy via the start
  command; readiness probes hold traffic off a node until the DB is
  reachable.
- **Docker / docker-compose** is how you get local parity with the
  hosted shape and how any other platform (Fly, Render, k8s, a VM)
  would consume the app. The Dockerfiles are the source of truth for
  "how to build and run the service"; Railway's config only adds the
  orchestration layer on top. If you move off Railway, you take the
  Dockerfiles and replace only `railway.json`.

No piece of VeriFlow is Railway-specific. Railway-specific behavior
lives in the two `railway.json` files; everything else is portable.

## Service topology

| Service  | Container | Exposes | Depends on |
| -------- | --------- | ------- | ---------- |
| backend  | `backend/Dockerfile`  | `:8000` (via `$PORT`) | Postgres, optionally a volume |
| frontend | `frontend/Dockerfile` | `:3000` (via `$PORT`) | backend public URL |
| postgres | Railway plugin        | `5432`               | — |

## What is automated vs manual

| Step | Where |
| --- | --- |
| Image build on each push | Railway (Dockerfile builder, config in each `railway.json`) |
| `alembic upgrade head` at deploy | Railway (baked into the backend start command) |
| DB readiness probe | Railway (`/health/readiness` on the backend, `/login` on the frontend) |
| Environment variable provisioning | Manual (set once per service in Railway UI) |
| Attaching an evidence volume | Manual (Railway → Volumes → mount `/var/lib/veriflow/evidence`) |
| Demo seed | Manual; refuses to run in non-dev envs unless `VERIFLOW_ALLOW_SEED=true` |
| Rollback to a previous deployment | Manual (Railway UI → previous deploy → "Redeploy") |

The baseline Alembic migration (`0001_initial_schema.py`) is locked.
Every schema change ships as an incremental revision under
`backend/migrations/versions/`. Upgrades run on every backend start;
rollbacks are a manual `alembic downgrade <rev>` against `DATABASE_URL`
(Railway's shell on the backend service can invoke it directly).

## Railway wiring

> **First thing to check if a build fails with
> `Railpack could not determine how to build the app` or
> `Script start.sh not found`:** the service's **Root Directory** is
> still pointed at the repo root. Go to
> _Service → Settings → Source → Root Directory_ and set it to
> `backend` (for the backend service) or `frontend` (for the frontend
> service). Without this, Railway never sees `Dockerfile` or
> `railway.json` and falls back to its default Railpack builder, which
> can't infer anything from a monorepo root.

`backend/railway.json` and `frontend/railway.json` are picked up when
each service's root directory is set to `backend` or `frontend`. Both
configs use the `DOCKERFILE` builder and `ON_FAILURE` restart policy
with a bounded retry count, so a crash-looping revision does not mask
the previous healthy one forever.

### Creating the services in Railway

1. **Backend service**
   - New service → Deploy from GitHub → this repo.
   - _Settings → Source → Root Directory_: `backend`.
   - _Variables_: populate the required env vars listed below.
   - Attach the Postgres plugin; reference its URL via
     `${{Postgres.DATABASE_URL}}`.
   - Attach a volume at `/var/lib/veriflow/evidence` and set
     `EVIDENCE_STORAGE_DIR` to match.
2. **Frontend service**
   - New service → Deploy from GitHub → same repo.
   - _Settings → Source → Root Directory_: `frontend`.
   - _Variables_: set `NEXT_PUBLIC_API_BASE_URL` to the backend's
     public URL followed by `/api`.
   - Changing `NEXT_PUBLIC_API_BASE_URL` triggers a rebuild because
     Next.js inlines it at build time.

### Backend service

Required environment variables:

| Variable | Value | Notes |
| --- | --- | --- |
| `APP_ENV` | `production` | Refuses the default JWT secret; also gates the seed. |
| `JWT_SECRET` | random 32+ bytes | `openssl rand -hex 32`. |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | Reference the attached Postgres plugin. |
| `CORS_ORIGINS` | frontend public URL | Comma-separated; include the Railway-assigned HTTPS host. |
| `EVIDENCE_STORAGE_DIR` | `/var/lib/veriflow/evidence` | Must match the Railway volume mount path. |

Optional:

- `MAX_UPLOAD_BYTES` — override the 25 MiB default cap.
- `RATE_LIMIT_*_PER_MINUTE` — loosen or tighten per-bucket limits.
- `CONTENT_ACCESS_TTL_SECONDS` — signed-URL expiry (default 120s).
- `VERIFLOW_ALLOW_SEED` — **do not set in production.** Staging only,
  and only if you want the demo org materialized once.

The Railway config declares `/health/readiness` as the healthcheck.
That endpoint returns `200` only after the DB is reachable, so Railway
keeps traffic on the previous revision until the new one finishes
migrations.

### Frontend service

Required environment variables:

| Variable | Value | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | backend public URL + `/api` | Baked into the client bundle at build time. Rebuilds are required after a change. |

`NEXT_PUBLIC_*` values are inlined at `next build` time. Changing this
variable in Railway triggers a rebuild — the running container cannot
pick it up on the fly.

The frontend healthcheck points at `/login`, which is a static-route
`200` regardless of backend reachability. Frontend "up" therefore
explicitly does not imply "backend up"; correctness of the end-to-end
flow still depends on the backend's own readiness probe.

### Postgres plugin

Attach Railway's Postgres 16 plugin. No schema bootstrap is required —
the backend's start command runs `alembic upgrade head` every deploy
and the baseline revision creates all tables.

### Service-to-service URL expectations

Railway services talk over the public internet unless you set up a
private network. The frontend's `NEXT_PUBLIC_API_BASE_URL` must be the
**public** backend URL (`https://<backend>.up.railway.app/api`) because
it is evaluated in the user's browser. The backend does not need to
call the frontend at all.

## Evidence storage

Railway's ephemeral filesystem loses writes on redeploy. Options:

1. **Railway volume (recommended).** Mount a volume at
   `/var/lib/veriflow/evidence` and set `EVIDENCE_STORAGE_DIR` to match.
   `backend/railway.json` assumes this path. Volume attachment is the
   one Railway-side action that is not automated by config.
2. **Object storage.** Swap `evidence_storage` for an S3-backed
   implementation behind the same interface. No schema changes
   required. Not shipped in this repo.

## Release migrations

`alembic upgrade head` runs in the backend's start command before
uvicorn binds the port. Readiness returns `503` until both uvicorn is
up and the DB ping succeeds. Railway keeps the previous revision
serving traffic while a new one fails to come ready.

For risky schema changes, split the deploy:

1. Ship the migration with code that tolerates both the old and new
   schema.
2. Once fully rolled out, ship a follow-up deploy that removes the
   compatibility shims.

A rollback is a manual `alembic downgrade <rev>` inside the Railway
shell on the backend service, followed by redeploying the previous
image.

## Local parity

`docker compose up --build` from the repo root brings up the same
three-service topology against a local Postgres. The compose file sets
`APP_ENV=development` on the backend, which is the only configuration
that enables the demo seed. No other local state is assumed.
