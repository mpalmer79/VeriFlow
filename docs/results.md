Pushed. Here's the diagnosis for all three categories:

### 1. Playwright — operations spec strict-mode violation
`getByRole("heading", { name: "Operations" })` matches by substring, so it picked up both `<h1>Operations</h1>` and the new `<h2>Destructive operations</h2>` I added in Phase 11. **Fix in code:** `{ name: "Operations", exact: true }`.

### 2. Playwright — typography-motion login timeout
The suite does ~10 fresh logins in one IP over ~1 minute. With `RATE_LIMIT_LOGIN_PER_MINUTE=10` (the production default) the last test started getting 429'd, the login form showed an error, and the URL stayed at `/login`. **Fix in code:** set `RATE_LIMIT_LOGIN_PER_MINUTE: "200"` on the e2e CI job only — production budgets are unchanged.

### 3. Railway frontend build blocked by Next CVEs
The log said exactly what to do: "Upgrade to 14.2.35." Bumped `next` to `14.2.35` and regenerated `package-lock.json`. Type-check + `next build` clean.

### 4. Railway backend — healthcheck 503 (no code fix)
This is an environment/plugin issue, not a code bug. The readiness probe returns 503 when the DB isn't reachable. Your two options:

1. **Attach the Postgres plugin to this project** (the most likely missing piece). New Service → Plugin → PostgreSQL. Then on the backend service, set `DATABASE_URL = ${{Postgres.DATABASE_URL}}` (Railway's variable reference syntax).
2. **Verify the other required env vars are set on the backend service:**
   - `APP_ENV=production`
   - `JWT_SECRET` (generate with `openssl rand -hex 32`)
   - `CORS_ORIGINS` (the frontend's public URL — a plain string works now, e.g. `https://veriflow-frontend.up.railway.app`)
   - `EVIDENCE_STORAGE_DIR=/var/lib/veriflow/evidence` (and attach a volume at that path)

Once Postgres is attached and `DATABASE_URL` reference is set, the start command (`alembic upgrade head && uvicorn ...`) will apply the migration and `/health/readiness` will start returning 200.
