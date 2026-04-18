# VeriFlow

VeriFlow is a workflow intelligence platform. It enforces process compliance,
detects operational risk, and explains — in plain language — why a record is
blocked, warned, or ready to proceed.

It is **not** an EHR, scheduling system, or CRM. VeriFlow tracks records as
they move through controlled workflow stages and evaluates each transition
against rules that determine whether progression is allowed, what risk has
accumulated, and what the user must resolve next.

## What VeriFlow does

- Enforces multi-stage workflows with controlled progression
- Evaluates rule-based conditions at each stage
- Blocks or flags transitions that fail required checks
- Calculates and surfaces a per-record risk score and risk band
- Produces clear, human-readable explanations for every decision
- Maintains a full audit trail of actions and rule outcomes

## Example scenario: healthcare intake

The first reference scenario is a healthcare intake and compliance workflow.
A record represents a prospective patient progressing through onboarding:

1. **New Intake** — record created, basic identifying details captured
2. **Identity Verification** — government ID and demographic checks
3. **Insurance Review** — coverage verified, pending, or acknowledged uninsured
4. **Consent & Authorization** — required forms signed and current
5. **Clinical History Review** — intake forms complete and reviewed
6. **Provider Triage** — clinical handoff to the appropriate provider
7. **Ready for Scheduling** — all checks passed; eligible to schedule
8. **Blocked** — one or more rules failed; resolution required
9. **Closed** — terminal disposition for the record

VeriFlow enforces the stage requirements. For example, a record cannot move
forward when consent is missing or expired, and an invalid insurance state
contributes to the record's risk score and may block progression.

This scenario is a **demonstration** of the platform's capabilities, not a
full healthcare implementation. The same engine is intended to apply to
finance, operations, and other compliance-heavy domains.

## Repository layout

```
.
├── ARCHITECTURE.md      System design overview
├── README.md            This file
├── backend/             FastAPI service (Python 3.11+)
├── frontend/            Next.js + TypeScript scaffold
└── docs/                Product and workflow documentation
```

## Backend quick start

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env

# Seed demo data (uses DATABASE_URL from .env; defaults to local SQLite)
python -m app.seed.seed_data

# Run the API
uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs
Health check: http://localhost:8000/health

### Demo accounts (after seeding)

All demo users share the password `VeriFlow!2025`.

| Role                | Email                        |
| ------------------- | ---------------------------- |
| admin               | admin@veriflow.demo          |
| intake_coordinator  | intake@veriflow.demo         |
| reviewer            | reviewer@veriflow.demo       |
| manager             | manager@veriflow.demo        |

### Running the tests

```bash
cd backend
pytest
```

Tests use an in-memory SQLite database and seed the demo organization,
workflow, and records on every run.

## Frontend quick start

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

The frontend in this phase is a structural scaffold with placeholder pages at
`/`, `/login`, and `/dashboard`.

## Status

Phase 0 and Phase 1 are complete: monorepo structure, data model, JWT auth,
record CRUD, seed data, tests, and frontend scaffold. The rule engine, risk
calculation, and document workflow are intentionally deferred — see
[`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full design and roadmap.
