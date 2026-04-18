# VeriFlow Frontend

Next.js + TypeScript scaffold for the VeriFlow web client. Phase 1 ships the
project structure and placeholder routes only — full UI wiring lands in later
phases.

## Getting started

```bash
cp .env.example .env.local
npm install
npm run dev
```

The app expects the FastAPI backend at `NEXT_PUBLIC_API_BASE_URL`
(default `http://localhost:8000/api`).

## Routes

- `/` — landing page
- `/login` — sign-in placeholder
- `/dashboard` — workflow overview placeholder
