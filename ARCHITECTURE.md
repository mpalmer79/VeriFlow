# VeriFlow — Architecture

## Overview

VeriFlow is a workflow intelligence platform. Its purpose is to enforce
process compliance, surface operational risk, and explain — in human-readable
terms — why a given record is blocked, warned, or ready to advance.

Records move through a defined sequence of workflow stages. At every
transition, rules evaluate the record's current state, determine whether
progression is allowed, contribute to a risk score, and emit explanations
that are surfaced to the user and persisted for audit.

The first reference scenario is a healthcare intake workflow. The system
itself is domain-agnostic: the same engine is intended to apply to finance,
operations, and other compliance-heavy domains.

## System Components

### Frontend — Next.js + TypeScript

A thin client that renders workflow state, presents rule outcomes and
explanations, and lets authorized users act on records. Phase 1 ships a
structural scaffold only (`/`, `/login`, `/dashboard`).

### Backend — FastAPI + Python

Stateless HTTP API. Owns authentication, record lifecycle, rule evaluation,
risk calculation, and audit logging. Strict layering between API routes,
services, and repositories keeps domain logic out of HTTP handlers.

### Database — PostgreSQL

System of record. SQLAlchemy 2.x is the ORM. Enums are persisted as
database-backed types via `sqlalchemy.Enum(..., native_enum=True)` so they
remain first-class in production Postgres while still working under SQLite
for local tests.

## Core Concepts

### Records

A record is the unit of work that flows through a workflow. In the demo
scenario it represents a prospective patient. Records carry domain-relevant
fields (subject identity, insurance status, consent status, clinical history
status), the current stage, an aggregate risk score and risk band, and a
reference to the workflow they belong to.

The record model is intentionally generic. Domain-specific extensions are
expected to live alongside the record (e.g. document attachments, structured
form responses) rather than mutating the core schema for each new domain.

### Workflows

A workflow is an ordered sequence of stages. Stages have a deterministic
`order_index` and a terminal flag. Records always reference a `current_stage`
within their workflow. The Healthcare Intake workflow ships with nine stages,
including the terminal `Blocked` and `Closed` dispositions.

### Rules

A rule is a named, code-driven check that runs against a record at one or
more stages. Each rule has an action (`warn` or `block`), a severity
(`warning`, `high`, `critical`), and a risk weight. Rules are stored in the
database so they can be enabled, audited, and reasoned about independently
of the code that evaluates them, but their evaluation logic lives in code
during the early phases — there is **no** visual rule builder and no
runtime DSL.

Rule `code` is unique **per workflow**, not globally. The same code (for
example `insurance.status_known`) may exist in multiple workflows with
different actions, severities, or risk weights. This is enforced by a
composite unique constraint on `(workflow_id, code)`.

### Rule evaluations

Every rule evaluation against a record is persisted as a `RuleEvaluation`
row. The row captures a structured outcome intended to support
explainability and audit:

- `passed` — `true` when the record satisfied the rule
- `action_applied` — `none`, `warn`, or `block`; the action the engine
  actually took for this evaluation
- `risk_applied` — the integer risk contribution recorded for this
  evaluation (zero when the rule passed or had no weight)
- `explanation` — human-readable text surfaced to the user

Historical evaluations are retained so the audit log can answer not only
"what was the outcome" but "what did each active rule say, and what did it
contribute to the record's risk".

### Risk scoring

Each rule contributes to a record's risk score when triggered. The aggregate
score is bucketed into a `risk_band` (`low`, `moderate`, `high`, `critical`).
The risk band is a coarse signal for prioritization and dashboard surfacing;
the fine-grained `risk_score` is used by services that need ordering or
thresholds.

### Audit logging

Every significant write — record creation, record update, rule evaluation,
stage transition, authentication event — produces an `AuditLog` entry. Logs
capture the actor, the affected entity, and a structured payload. They are
append-only and form the basis for compliance reporting.

## Service Architecture

Services own domain logic. Routes are thin and delegate to services.
Repositories own data access and isolate SQLAlchemy from the rest of the
codebase.

### `auth_service`

- Authenticates users by email and password (bcrypt verification)
- Issues JWT access tokens with role and organization claims
- Resolves the current user from a token subject for request authorization

### `record_service`

- Lists, creates, retrieves, and updates records scoped to the caller's
  organization
- Places new records on the first stage of the chosen workflow unless an
  explicit `current_stage_id` is provided
- Validates workflow/stage integrity on both create and update: a stage
  must belong to the record's workflow or the operation is rejected with a
  clear `StageWorkflowMismatch` error (HTTP 400)
- Emits audit events for create and update operations
- Will, in later phases, invoke `rule_engine_service` and `risk_service` on
  every mutation

### `workflow_service` (in-progress)

Currently exposed as `workflow_repository`. As the rule engine matures, a
`workflow_service` will own stage-transition policy, terminal-state handling,
and workflow versioning.

### `document_service` (planned)

Will manage document attachments — upload metadata, status transitions
(`pending`, `received`, `rejected`, `expired`), and rule contributions
(e.g. expired consent forms blocking progression).

### `rule_engine_service` (planned)

Will evaluate active rules for a workflow + stage against a record, persist
`RuleEvaluation` rows, and return a structured outcome (allowed / blocked,
triggered rules, explanations). The engine will remain code-driven in early
phases — rule definitions are data, but evaluation logic is Python.

### `risk_service` (planned)

Will aggregate triggered rules' weights into a `risk_score` and map the
score to a `risk_band`. Decoupled from the rule engine so weighting and
banding can evolve independently.

### `audit_service`

Records structured audit events with actor, entity, and payload. Used by
every service that mutates state. Append-only by contract.

## Data Flow

The intended end-to-end flow for a record mutation:

1. **HTTP request** — `PATCH /api/records/{id}` with proposed changes
2. **Authentication** — `auth_service` resolves the JWT to a user; the
   request is rejected if the user is missing, inactive, or unauthorized
3. **Record service** — applies the change in memory and validates basic
   invariants (e.g. stage belongs to the record's workflow)
4. **Rule engine evaluation** *(planned)* — `rule_engine_service` evaluates
   all active rules for the workflow + new stage against the proposed state
5. **Risk calculation** *(planned)* — `risk_service` aggregates triggered
   rules into a new `risk_score` and `risk_band`
6. **Persistence** — record is saved with its new state, evaluations are
   stored, and the response is shaped (allowed / blocked, explanations,
   risk band)
7. **Audit log** — `audit_service` records the mutation, the actor, and the
   structured outcome
8. **Response** — the API returns the updated record plus, in later phases,
   the structured rule outcome and explanations

In Phase 1, steps 4 and 5 are stubbed — risk fields are read from the
record's current values rather than recomputed — so the surface area is
ready for the engine without overcommitting to a design.

## Key Design Decisions

- **Code-driven rules in early phases.** Rules live in the database for
  visibility and toggling, but evaluation logic is Python. A DSL or visual
  rule builder is explicitly out of scope until the engine has proven itself
  against real scenarios.
- **Generic record model.** The `Record` table carries domain-relevant
  fields for the healthcare scenario but is structured so new domains can
  attach via related tables rather than schema churn.
- **Healthcare is a demonstration.** The intake workflow exercises the
  platform end-to-end. It is not an attempt to model a real clinical system,
  and no PHI handling, HIPAA controls, or clinical decision support are
  implied.
- **Strict layering.** API → service → repository → ORM. Routes never touch
  the database directly; repositories never raise HTTP exceptions.
- **Database-backed enums.** Enum columns use SQLAlchemy `Enum` with
  `native_enum=True` so production Postgres uses real enum types.
- **Workflow-scoped integrity.** Rule codes are unique per workflow and
  record/stage pairings are validated in the service layer. Integrity
  rules that cannot be expressed as FK constraints live in services so
  violations return structured, user-facing errors.
- **JWT for auth.** Stateless tokens with role and organization claims keep
  the API horizontally scalable and easy to integrate.

## Future Extensions

- **Rule engine expansion** — pluggable rule handlers, stage-aware policy,
  per-rule explanation templates, dry-run evaluation.
- **Multi-domain support** — additional reference workflows (loan intake,
  vendor onboarding, claims triage) using the same engine.
- **External integrations** — webhook delivery for state changes, inbound
  document ingestion, identity-verification providers, insurance
  eligibility checks.
- **Reporting and analytics** — aggregate risk over time, bottleneck
  detection by stage, rule-trigger frequency, SLA tracking.
- **Frontend** — full record list, stage view, rule-outcome surface, and
  audit timeline.
