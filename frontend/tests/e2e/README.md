# End-to-end tests

Minimal Playwright scaffolding for VeriFlow.

## Prerequisites

- Backend running on `http://localhost:8000` with the demo seed applied
  (`docker compose up` from the repo root is the easiest path).
- Frontend running on `http://localhost:3000`
  (`npm run dev` from `frontend/`).

## One-time setup

```bash
cd frontend
npm install
npm run test:e2e:install   # downloads the Chromium browser
```

## Running

```bash
npm run test:e2e
```

Override the target with `PLAYWRIGHT_BASE_URL=https://staging.example.com`
if you want to point at a remote deployment.

## Credentials

Tests use the demo accounts created by `backend/app/seed/seed_data.py`.
The shared password lives in `DEFAULT_PASSWORD` there; treat it as
development-only.
