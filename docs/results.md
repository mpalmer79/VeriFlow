Phase 7 committed (`68a664a`) and pushed. **184 backend tests passing**, frontend build succeeds, baseline migration unchanged, **no new migration required**.

## Summary

**7A. Backend modularity.** `document_service.py` is now a `document_service/` package with focused modules (`ingest`, `verification`, `content`, `cleanup`, `summary`) and a private `_core.py` for shared exceptions and access helpers. The package `__init__` re-exports every public name, so existing imports and Phase 2–6 tests keep working untouched.

**7B. Frontend productization.** The record detail page is now a thin orchestrator over a new `components/record-detail/` package (RecordHeader, ActionBar, EvaluationPanel, WorkflowTimeline, EvidenceSummaryStrip, UploadForm, DocumentEvidencePanel, DocumentRows, PreviewOverlay, AuditTrail). Visual rhythm and grouping tightened — no emoji, no icon chrome, no gradients.

**7C. CI workflow.** `.github/workflows/ci.yml` with three jobs:
- `backend-sqlite` — pytest + Alembic smoke-test on SQLite
- `backend-postgres` — `postgres:16` service container, `alembic upgrade head`, then pytest against Postgres via `TEST_DATABASE_URL`
- `frontend` — `npm ci` + `type-check` + `build`

**7D. Deployment.** `backend/Dockerfile` (non-root, uvicorn), `frontend/Dockerfile` (multi-stage, `next start`), `docker-compose.yml` that wires Postgres + backend + frontend and runs migrations + idempotent seed on startup.

**7E. Security tightening.**
- `Settings` refuses to start outside `development`/`test`/`ci` while `JWT_SECRET` is still the default (`UnsafeConfigurationError`).
- CORS is explicit: configured methods / headers, narrow `expose_headers`, no more `["*"]`.
- New `core/rate_limit.py` — in-process sliding-window limiter with a FastAPI dependency factory. Applied to `/auth/login`, `/records/{id}/documents/upload`, `/documents/{id}/signed-access`. Test fixture resets buckets.

**7F. Test strategy.** conftest honors `TEST_DATABASE_URL` so the CI matrix runs the suite against real PostgreSQL while local development keeps the fast in-memory SQLite loop.

**7G. README.** Rewritten to cover architecture, local/Docker run, config, CI, Alembic, PostgreSQL testing, and security posture — with known limitations stated plainly.

## Files modified
- `README.md`
- `backend/app/api/routes/auth.py` · `documents.py` · `records.py`
- `backend/app/core/config.py`
- `backend/app/main.py`
- `backend/requirements.txt`
- `backend/tests/conftest.py`
- `frontend/app/(app)/records/[id]/page.tsx`
- `frontend/lib/format.ts`
- Deleted: `backend/app/services/document_service.py`

## Files added
- `.github/workflows/ci.yml`
- `backend/Dockerfile` · `backend/.dockerignore`
- `frontend/Dockerfile` · `frontend/.dockerignore`
- `docker-compose.yml`
- `backend/app/core/rate_limit.py`
- `backend/app/services/document_service/__init__.py` · `_core.py` · `ingest.py` · `verification.py` · `content.py` · `cleanup.py` · `summary.py`
- `frontend/components/record-detail/*.tsx` (10 components)
- `backend/tests/test_phase7_hardening.py`

## Migration files
**No new migration required.** Baseline `0001_initial_schema.py` unchanged; Phase 7 is routes / services / config / infrastructure only.

## Tests added / updated
- **Added** `tests/test_phase7_hardening.py` (15 tests):
  - document_service package re-exports the full public surface; submodules load
  - Settings refuses the default secret in production, accepts it in dev-like envs, accepts any real secret anywhere
  - CORS defaults aren't wildcard; preflight advertises configured methods
  - Rate limits trip at `/auth/login`, `/documents/upload`, and `/documents/{id}/signed-access` when the budget is shrunk
  - CI workflow is valid YAML with real `pip install`, `pytest`, `alembic upgrade head`, `npm ci`, `npm run type-check`, `npm run build` commands
  - Dockerfiles reference real commands and non-root users
  - `docker-compose.yml` wires `db`, `backend`, `frontend` and runs migrations in the backend entrypoint
  - Record detail page imports every extracted component
- **Updated** `conftest.py` to honor `TEST_DATABASE_URL` and reset rate-limit buckets between tests.

## Remaining limitations

- **Rate limiter is in-process.** Single-replica only. Swap to a Redis-backed implementation for horizontal scaling; the `rate_limit()` dependency factory is the only API that needs to change.
- **Evidence storage stays local.** Same as before — no S3/GCS; the storage interface would slot a cloud backend behind `evidence_storage` without schema changes.
- **PostgreSQL parity in CI only.** The `TEST_DATABASE_URL` plumbing works locally too, but developers still default to SQLite. A `Makefile` or `tox.ini` target could make the Postgres loop one command.
- **Frontend automated tests remain absent.** The CI build + type-check guard regressions in imports/signatures but not interaction behavior. Adding Playwright is the natural next step.
- **Signed content-access tokens can be replayed until expiry (default 120s).** A `jti` denylist would make them strict one-shot.
- **Accessibility coverage ends at the preview dialog.** Other prompts (rejection reason, delete confirm) still use native browser dialogs.
- **Alembic is not invoked at app startup.** `docker compose` runs it as part of the backend command, but a bare `uvicorn` launch still requires manual `alembic upgrade head` first. Documented; not automated.
- **The Postgres CI job runs the same tests as the SQLite one.** A few Phase 2 integrity tests explicitly exercise SQLite partial-index behavior; they'll pass on Postgres too, but dedicated Postgres-specific tests (native enum migrations, transactional DDL) are still deferred.
