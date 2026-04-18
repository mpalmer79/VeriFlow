# VeriFlow — Workflow, Rules, and Transitions

This document describes the Healthcare Intake workflow, the initial rule
set, how evaluation runs, and how stage transitions are enforced.

## Healthcare Intake — stages

| # | Stage                    | Slug                      | Terminal | Purpose                                                     |
|---|--------------------------|---------------------------|----------|-------------------------------------------------------------|
| 1 | New Intake               | `new_intake`              | no       | Record created; initial subject details captured            |
| 2 | Identity Verification    | `identity_verification`   | no       | Government ID + demographic checks                          |
| 3 | Insurance Review         | `insurance_review`        | no       | Coverage verified, pending, or acknowledged uninsured       |
| 4 | Consent & Authorization  | `consent_authorization`   | no       | Required consent forms signed and current                   |
| 5 | Clinical History Review  | `clinical_history_review` | no       | Intake forms complete and reviewed                          |
| 6 | Provider Triage          | `provider_triage`         | no       | Assigned to the appropriate provider                        |
| 7 | Ready for Scheduling     | `ready_for_scheduling`    | yes      | All checks passed; eligible to schedule                     |
| 8 | Blocked                  | `blocked`                 | yes      | One or more rules failed; resolution required               |
| 9 | Closed                   | `closed`                  | yes      | Terminal disposition for the record                         |

`Blocked` and `Closed` are terminal. Records re-open from `Blocked` once
the underlying rule passes.

## Rule registry

Rules in VeriFlow are **code-driven**. There is no DSL, no visual rule
builder, and no free-form expression parser. The design is a controlled
registry:

- Every rule has a string `code` and a Python evaluator function.
- Evaluators register with `@register("<code>")` in
  `app/services/rules.py`.
- The `Rule` database row carries metadata only: `workflow_id`,
  `stage_id`, `code`, `name`, `description`, `action` (`warn` or
  `block`), `severity` (`warning`, `high`, `critical`), `risk_weight`,
  and `is_active`.
- An evaluator receives the record and the `Rule` row and returns a
  `RuleResult` (`rule_code`, `passed`, `action_applied`, `message`,
  `risk_applied`).
- The engine applies the rule's configured `action` on failure, so the
  same evaluator can be reused across workflows with different
  severities and weights.

Rule `code` is unique per workflow via the composite
`(workflow_id, code)` constraint.

## Initial rules

Seven rules ship with the Healthcare Intake workflow. Four are blocking,
three are warnings. Rules marked "hybrid" pass when **either** the
legacy flag is set **or** a verified document of the listed type is
attached.

| Code | Action | Stage gate | Risk weight | Passes when… |
|------|--------|------------|-------------|----------------|
| `identity_required` | block | Identity Verification | 40 | verified `photo_id` document OR `identity_verified` *(hybrid)* |
| `insurance_verified_or_self_pay` | block | Insurance Review | 45 | verified `insurance_card` OR `insurance_status` is `verified`/`uninsured_acknowledged` *(hybrid)* |
| `consent_required` | block | Consent & Authorization | 50 | verified `consent_form` OR `consent_status == signed` *(hybrid)* |
| `guardian_authorization_required` | block | Consent & Authorization | 60 | subject is 18+ OR verified `guardian_authorization` OR `guardian_authorization_signed` *(hybrid)* |
| `medical_history_warning` | warn | Clinical History Review | 15 | verified `medical_history_form` OR `medical_history_status == complete` *(hybrid)* |
| `allergy_warning` | warn | Clinical History Review | 10 | `allergy_info_provided` is true |
| `out_of_network_warning` | warn | Insurance Review | 20 | `insurance_in_network` is not explicitly `false` (self-pay passes) |

The `stage_id` on a rule row drives **stage-aware filtering** (added in
Phase 3):

- rules with `stage_id = NULL` are workflow-global and always apply
- rules with a `stage_id` apply when that stage's `order_index` is `<=`
  the evaluation's stage context

The `evaluate` endpoint uses the record's current stage as the context;
the `transition` endpoint uses the target stage as the context, so a
transition to a later stage pulls in every rule up to and including that
stage.

## Risk scoring

`risk_service` aggregates `risk_applied` values from triggered
evaluations. The score maps to a `RiskBand` using inclusive thresholds:

| Score range | Band       |
|-------------|------------|
| 0 – 24      | `low`      |
| 25 – 49     | `moderate` |
| 50 – 79     | `high`     |
| 80+         | `critical` |

These thresholds are centralized in `risk_service` and can evolve without
touching the engine or persistence.

## Evaluation flow

`evaluation_service.evaluate_and_persist` is the single entry point for
running rules against a record. One run:

1. loads all active rules for the record's workflow
2. invokes each rule's registered evaluator
3. asks `risk_service` to compute the aggregate score and band
4. **replaces** the record's `rule_evaluations` rows with the new set
5. writes the new `risk_score` and `risk_band` back to the record
6. emits `record.evaluated` and `record.risk_recalculated` audit events

The `rule_evaluations` table therefore always reflects the **current**
evaluation run. Long-term history lives in the append-only audit log.
This keeps explainability questions ("why is this record blocked right
now?") unambiguous.

## Transition enforcement

`workflow_service.transition_record` gates every stage change on
evaluation:

- the target stage must belong to the record's workflow
- `record.transition_attempted` is logged
- evaluation runs in the same transaction as the transition
- if any `BLOCK` rule fails, the transition is rejected, the current
  stage is preserved, and `record.transition_blocked` is logged
- if only warnings are present, the stage is updated and
  `record.transition_completed` is logged
- the response payload includes the full `EvaluationDecision`
  (`can_progress`, `risk_score`, `risk_band`, `violations`, `warnings`,
  `summary`) so callers always know what happened and why

## API surface

- `POST /api/records/{id}/evaluate` — runs evaluation against the
  record's current stage, persists results, returns the
  `EvaluationDecision`
- `GET /api/records/{id}/evaluations` — returns the current
  `RuleEvaluation` rows for the record
- `POST /api/records/{id}/transition` — attempts a transition; body is
  `{ "target_stage_id": <int> }`; evaluation runs with the target stage
  as the context so rules for stages the record is about to enter apply
- `GET /api/records/{id}/documents` — list documents on the record
- `POST /api/records/{id}/documents` — upload a document metadata entry
- `GET /api/records/{id}/document-status` — required vs present vs
  verified vs missing vs rejected summary
- `POST /api/documents/{id}/verify` / `POST /api/documents/{id}/reject`
  — mark a document verified or rejected (with optional reason)

See [`document_evidence.md`](./document_evidence.md) for the document
evidence model and the hybrid rule evaluation contract.
