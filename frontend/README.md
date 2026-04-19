# VeriFlow Frontend

Next.js 14 (app router) + TypeScript + Tailwind CSS. This is the Phase 4
demonstration surface for the VeriFlow backend.

## Pages

| Route                 | Purpose                                                                        |
|-----------------------|--------------------------------------------------------------------------------|
| `/login`              | Sign-in form against the backend auth API. Includes local demo-account helper.|
| `/dashboard`          | Operational overview — stat cards for active/blocked/high-risk records plus a "needs attention" list. |
| `/records`            | Records table with search and stage / risk-band / status filters.              |
| `/records/{id}`       | The demonstration page. Evaluation, violations, warnings, stage timeline, document evidence, actions (run evaluation, attempt transition, verify/reject documents), and audit trail. |

Unauthenticated users are redirected to `/login` with a `?next=` hint so
sign-in returns them to the page they requested.

## Running locally

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

The app reads `NEXT_PUBLIC_API_BASE_URL` (defaults to
`http://localhost:8000/api`). Start the backend first:

```bash
cd ../backend
uvicorn app.main:app --reload --port 8000
```

Seed the backend (idempotent) before signing in:

```bash
cd backend
python -m app.seed.seed_data
```

## Local demo access

Use one of the seeded accounts (shared password: `VeriFlow!2025`):

- `admin@veriflow.demo`
- `intake@veriflow.demo`
- `reviewer@veriflow.demo`
- `manager@veriflow.demo`

The login page provides "Use this" buttons so you do not have to retype
them. These credentials exist only in local seeded databases.

## Project layout

```
frontend/
├── app/
│   ├── layout.tsx            Root layout (fonts, globals)
│   ├── globals.css           Tailwind base + component utility classes
│   ├── page.tsx              Landing → redirects to /login or /dashboard
│   ├── login/page.tsx        Unprotected sign-in page
│   └── (app)/                Route group for authenticated pages
│       ├── layout.tsx        AppShell wrapper (header + auth guard)
│       ├── dashboard/page.tsx
│       └── records/
│           ├── page.tsx
│           └── [id]/page.tsx
├── components/               Small shared components (badges, panels, skeleton, shell)
├── lib/
│   ├── api.ts                Typed HTTP client wrapping the backend API
│   ├── auth.ts               Session helpers (localStorage-backed MVP)
│   ├── format.ts             Date + enum label helpers
│   └── types.ts              Response types mirroring the backend
├── tailwind.config.ts
├── postcss.config.js
└── package.json
```

## What this demonstrates

The record detail page is the centerpiece. It surfaces the backend's
intelligence end-to-end:

- Current stage and progress across the nine-stage workflow timeline.
- Risk score, risk band, and decision summary.
- Blocking violations and warnings, each tied to a named rule code
  (`identity_required`, `consent_required`, …) plus its human
  explanation — shown the same way before and after the user runs
  evaluation manually.
- Document evidence: required types, satisfied vs missing, plus the
  per-document verification lifecycle with verify / reject actions.
- Audit trail with canonical payloads for evaluation, risk
  recalculation, transitions, and document lifecycle events.
- Assignees are rendered by name (`assigned_user_name`) across the
  dashboard, records list, and detail view.

The UI is intentionally restrained. It exists to make the backend's
decisions explainable, not to sell a brand.

## Auth model (MVP)

Token is stored in `localStorage` under `veriflow.token`; the signed-in
user is cached under `veriflow.user`. `lib/api.ts` injects the bearer
token on every request. This is fine for a local walkthrough; for any
hosted deployment, switch to HTTP-only cookies.
