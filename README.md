# VeriFlow

VeriFlow is a workflow intelligence platform. It enforces process
compliance, detects operational risk, and explains — in plain language —
why a record is blocked, warned, or ready to proceed.

It is **not** an EHR, scheduling system, or CRM. VeriFlow tracks records
as they move through controlled workflow stages and evaluates each
transition against rules that determine whether progression is allowed,
what risk has accumulated, and what the user must resolve next. The
first reference scenario is a healthcare intake and compliance workflow;
the engine is domain-agnostic and designed to host loan intake, vendor
onboarding, claims triage, and similar workflows.

## Capabilities

- Controlled multi-stage workflows with explicit terminal states
- Code-driven rule registry evaluated per record at the appropriate
  stage context
- Risk scoring with a banded classification (`low` / `moderate` / `high`
  / `critical`)
- Document evidence layer with verification, rejection, and
  required-document tracking
- Stage-gated transitions that block on failing rules and explain the
  reason
- Append-only audit log with canonical, structured payloads

## Example: healthcare intake

A record represents a prospective patient progressing through a
nine-stage workflow:

1. **New Intake** — record created, basic identifying details captured
2. **Identity Verification** — government ID and demographic checks
3. **Insurance Review** — coverage verified, pending, or acknowledged self-pay
4. **Consent & Authorization** — required forms signed and current
5. **Clinical History Review** — intake forms complete and reviewed
6. **Provider Triage** — clinical handoff to the appropriate provider
7. **Ready for Scheduling** — all checks passed; eligible to schedule
8. **Blocked** — one or more rules failed; resolution required
9. **Closed** — terminal disposition for the record

A record cannot leave Consent & Authorization without a verified consent
document (or a signed-consent flag, during the hybrid rollout).
Out-of-network coverage raises the record's risk score but does not
block. Every decision is surfaced in the API response, persisted to
`rule_evaluations`, and logged to the audit trail with the rule codes
that produced it.

This scenario demonstrates the platform's capabilities and is not a full
healthcare implementation. No PHI handling, HIPAA controls, or clinical
decision support are implied.

## Repository layout

```
.
├── ARCHITECTURE.md          System design overview
├── README.md                This file
├── backend/                 FastAPI service (Python 3.11+)
│   ├── app/
│   │   ├── api/routes/      HTTP routes (thin)
│   │   ├── core/            config, database, security
│   │   ├── models/          SQLAlchemy 2.x models + enums
│   │   ├── repositories/    data access
│   │   ├── schemas/         Pydantic request/response shapes
│   │   ├── services/        domain logic (auth, records, docs, engine)
│   │   └── seed/            idempotent demo data
│   └── tests/               pytest suite
├── frontend/                Next.js + TypeScript scaffold
└── docs/
    ├── product_overview.md
    ├── workflow_rules.md
    └── document_evidence.md
```

## Running locally

### Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env

# Idempotent seed: organization, users, workflow, rules, requirements, demo records
python -m app.seed.seed_data

# Run the API
uvicorn app.main:app --reload --port 8000
```

- Interactive API docs: <http://localhost:8000/docs>
- Health check: <http://localhost:8000/health>

### Frontend

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Phase 4 ships a working frontend that demonstrates the backend
capabilities end-to-end: authentication, an operational dashboard, a
records table with filters, and a detail page that shows evaluation
outcomes, document evidence, workflow stage progress, and the audit
trail. Record responses include `assigned_user_name` and persisted
evaluations carry `rule_code` and `rule_name`, so the UI always shows
human-readable labels rather than raw foreign-key ids. See
[`frontend/README.md`](./frontend/README.md) for details.

### Tests

```bash
cd backend
pytest
```

The suite runs against an in-memory SQLite database seeded on every
test. CI-parity against PostgreSQL is a stated goal for the next
hardening pass.

## Local demo access

The seed script provisions four local demo accounts — one per role — so
the API can be exercised end-to-end without configuring an identity
provider. These credentials exist **only** in local seeded databases and
are not valid against any hosted environment. Rotate or disable them
before deploying anywhere non-local.

| Role                  | Email                     |
|-----------------------|---------------------------|
| `admin`               | `admin@veriflow.demo`     |
| `intake_coordinator`  | `intake@veriflow.demo`    |
| `reviewer`            | `reviewer@veriflow.demo`  |
| `manager`             | `manager@veriflow.demo`   |

The shared demo password is defined in
`backend/app/seed/seed_data.py::DEFAULT_PASSWORD`. Change it there (or
export your own and extend the seed) before running the seed in any
shared environment.

## Status

Phases 0 through 4 are complete. The backend runs a code-driven rule
engine, computes risk scores, persists evaluation outcomes, enforces
stage-gated transitions, and treats documents as first-class evidence.
Phase 4 adds a Next.js frontend that exposes that capability through a
focused operational UI.

Representative API surface:

- `POST /api/auth/login` · `GET /api/auth/me`
- `GET|POST /api/records` · `GET|PATCH /api/records/{id}`
- `POST /api/records/{id}/evaluate` · `GET /api/records/{id}/evaluations`
- `POST /api/records/{id}/transition`
- `GET|POST /api/records/{id}/documents`
- `GET /api/records/{id}/document-status`
- `GET /api/records/{id}/audit`
- `POST /api/documents/{id}/verify` · `POST /api/documents/{id}/reject`
- `GET /api/workflows/{id}`

For architecture, rule catalogue, and document evidence details, see:

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — system design and service boundaries
- [`docs/workflow_rules.md`](./docs/workflow_rules.md) — stages, rule catalogue, evaluation semantics
- [`docs/document_evidence.md`](./docs/document_evidence.md) — document model and hybrid rule contract
- [`docs/product_overview.md`](./docs/product_overview.md) — problem framing and product capabilities

Frontend UI, reporting, and analytics remain for subsequent phases.
