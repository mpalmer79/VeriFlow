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

The persistence contract for `rule_evaluations` is **current-state, not
history**. Every evaluation run replaces the record's previous rows so the
table always answers the question "why is this record blocked, warned, or
ready right now". Long-term history is captured in the append-only audit
log (`record.evaluated`, `record.risk_recalculated`, `record.transition_*`)
which records actor, timestamp, triggered rule codes, and the resulting
risk figures.

### Risk scoring

Each triggered rule contributes its `risk_weight` to the record's aggregate
`risk_score`. The score is bucketed into a `risk_band` using fixed
inclusive thresholds:

| Score range | Band       |
|-------------|------------|
| 0 – 24      | `low`      |
| 25 – 49     | `moderate` |
| 50 – 79     | `high`     |
| 80+         | `critical` |

The band is a coarse signal for prioritization and dashboard surfacing;
the fine-grained `risk_score` is used by services that need ordering or
thresholds. Scoring logic lives in `risk_service` as a pure function of
the evaluation results so thresholds can evolve without touching the
engine or the persistence layer.

### Audit logging

Every significant write — record creation, record update, rule
evaluation, stage transition, document lifecycle change — produces an
`AuditLog` entry. Logs capture the actor, the affected entity, and a
**structured, canonical payload**. Payload shapes are centralized in
`app/services/audit_payloads.py` so every event of a given action has
the same keys. They are append-only and form the basis for compliance
reporting.

Canonical payload fields include `record_id`, `current_stage_id`,
`target_stage_id`, `prior_stage_id`, `new_stage_id`, `prior_risk_score`,
`new_risk_score`, `risk_score`, `risk_band`, `blocking_rule_codes`,
`warning_rule_codes`, `stage_context_id`, `rules_evaluated`,
`document_id`, `document_type`, `document_status`, `verified_by`,
`rejected_by`, and `rejection_reason`. See
[`docs/document_evidence.md`](./docs/document_evidence.md) for the
per-action list.

### Document evidence

Documents are first-class evidence, not just metadata. `Document`
carries a verification lifecycle (`uploaded`, `verified`, `rejected`)
with verifier identity, timestamps, and rejection reason.
`DocumentRequirement` declares which document types a workflow needs,
optionally scoped to a stage. Required-vs-present-vs-verified status is
computed per record by `document_service`. Rules consume evidence via
small helpers in `document_repository`; hybrid rule logic keeps records
without documents meaningful while promoting document evidence as the
primary signal.

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

### `workflow_service`

Owns stage-transition policy. `transition_record` validates that the
target stage belongs to the record's workflow, runs evaluation through
`evaluation_service`, and rejects the transition when any blocking rule
fails. Warnings do not block. Successful transitions update
`current_stage_id`; blocked transitions leave the stage unchanged. Every
outcome is recorded in the audit log.

### `rule_engine_service`

Owns the rule **registry** and stage-aware filtering. Each rule `code`
maps to a Python evaluator function registered with
`@register("<code>")`. Evaluators receive the record and the `Rule` row
so the same evaluator can be reused across workflows with different
severities or risk weights. The engine exposes
`evaluate_record(db, record, stage_context=...)` which:

- loads every active rule for the record's workflow
- filters them via `applicable_rules(rules, stage_context, stages_by_id)`:
  workflow-global rules always apply; stage-gated rules apply when the
  rule's stage `order_index` is `<=` the context's `order_index`
- invokes each applicable evaluator and returns `RuleResult` objects

`stage_context` defaults to the record's current stage; transitions pass
the target stage so rules for stages the record is about to enter (or
cross) come into scope.

Several Phase 3 evaluators are **hybrid**: they pass when either the
record's legacy flag is set or the relevant `Document` is verified. See
`docs/document_evidence.md` for the per-rule mapping.

### `evaluation_service`

Orchestrates a single evaluation run. It calls `rule_engine_service`,
asks `risk_service` to aggregate the results, replaces the record's
`rule_evaluations` rows with the current set, writes the new
`risk_score` and `risk_band` onto the record, and emits `record.evaluated`
and `record.risk_recalculated` audit events. Returns a structured
`EvaluationDecision` (`can_progress`, `risk_score`, `risk_band`,
`violations`, `warnings`, `summary`). `workflow_service` invokes this
with `commit=False` so evaluation and transition land in the same
transaction.

### `risk_service`

Pure function. Aggregates `risk_applied` from triggered evaluations into
a total score and maps the score to a `RiskBand` using the thresholds
above. Has no database or side effects.

### `document_service`

Owns the document evidence layer. Upload, verify, reject, and per-record
document-status computation. Documents are first-class inputs to rule
evaluation via the `document_repository` helpers (`has_verified`,
`has_present`). Every lifecycle change (`uploaded`, `verified`,
`rejected`) emits a structured audit event. Required-document logic is
driven by the `DocumentRequirement` table, which scopes a document type
to a workflow and optionally a stage; `required_document_types` computes
the set in scope for a record given its current stage.

### `audit_service`

Records structured audit events with actor, entity, and payload. Used by
every service that mutates state. Append-only by contract.

## Data Flow

### Evaluation (`POST /api/records/{id}/evaluate`)

1. `auth_service` resolves the JWT and authorizes the request
2. `record_service.get_record` loads the record scoped to the caller's org
3. `evaluation_service.evaluate_and_persist` is invoked, which:
   a. asks `rule_engine_service` to evaluate every active rule for the
      record's workflow
   b. asks `risk_service` to aggregate `risk_applied` into a score + band
   c. replaces the record's `rule_evaluations` rows with the current set
   d. writes the new `risk_score` and `risk_band` onto the record
   e. emits `record.evaluated` and `record.risk_recalculated` audit events
4. The structured `EvaluationDecision` is returned as JSON

### Transition (`POST /api/records/{id}/transition`)

1. `auth_service` resolves the JWT and authorizes the request
2. `workflow_service.transition_record` loads the record and validates the
   target stage belongs to the record's workflow
3. `record.transition_attempted` is written to the audit log
4. `evaluation_service.evaluate_and_persist` runs within the same
   transaction (`commit=False`)
5. If any `BLOCK` rule fails, the transition is rejected: the current
   stage is unchanged, `record.transition_blocked` is logged, the
   transaction is committed, and the API returns `success=false` with the
   full decision payload
6. Otherwise the stage is updated, `record.transition_completed` is
   logged, the transaction is committed, and the API returns
   `success=true` with the updated stage and the decision payload

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
- **Current-state evaluation storage.** The `rule_evaluations` table is
  always a replica of the most recent run for each record. Evaluation
  history is captured in the append-only audit log. This avoids ambiguity
  about which rows represent the "current" outcome and keeps the
  explainability API simple.

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
