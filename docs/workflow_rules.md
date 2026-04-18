# VeriFlow — Workflow & Rule Concepts

This document describes the demo Healthcare Intake workflow and the initial
set of rule concepts the engine will enforce. The rule engine itself is
**not implemented** in Phase 1 — this document captures intent so the data
model and API surface stay aligned with where the engine is headed.

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

Records always move through stages by their `order_index` unless a rule
forces them to `Blocked`. `Blocked` and `Closed` are terminal: records can
re-open from `Blocked` once the underlying rule passes.

## Rule outcomes

Rules are defined per workflow. The `code` on a rule is unique within its
workflow, so the same code can exist in two workflows with different
configuration. A rule carries a static **action** (`warn` or `block`), a
**severity** (`warning`, `high`, or `critical`), and a **risk weight**.

Every evaluation of a rule against a record produces a `RuleEvaluation`
row with:

- `passed` — `true` when the record satisfied the rule
- `action_applied` — `none`, `warn`, or `block`; what the engine actually
  did for this evaluation
- `risk_applied` — integer risk contribution recorded for this evaluation
- `explanation` — human-readable text describing what failed and what is
  required to resolve it

Keeping the applied action and risk on the evaluation row (rather than
re-reading the rule definition) preserves the historical decision even if
the rule is later edited or disabled.

The aggregate `risk_score` is bucketed into a `risk_band`:

| Band      | Score range (initial) |
|-----------|-----------------------|
| `low`     | 0 – 24                |
| `moderate`| 25 – 49               |
| `high`    | 50 – 74               |
| `critical`| 75+                   |

Thresholds are intentionally conservative for Phase 1 and will be tuned
once real evaluation data exists.

## Initial rule concepts

These rules describe what the engine should evaluate per stage. Each is
named with the code it will be registered under.

### Identity Verification

- `identity.required_fields_present` — block if `subject_full_name` or
  `subject_dob` is missing.
- `identity.id_document_received` — warn if no ID document is attached;
  block when leaving this stage.

### Insurance Review

- `insurance.status_known` — block when leaving this stage if
  `insurance_status == unknown`.
- `insurance.invalid_blocks_progress` — block when
  `insurance_status == invalid`; force the record toward the `Blocked`
  stage.
- `insurance.uninsured_acknowledged` — warn when
  `insurance_status == uninsured_acknowledged`; allow progression but
  contribute risk.

### Consent & Authorization

- `consent.signature_required` — block when leaving this stage if
  `consent_status` is `not_provided` or `partial`.
- `consent.not_expired` — block when `consent_status == expired`; force
  toward `Blocked` regardless of current stage.

### Clinical History Review

- `clinical_history.complete` — block when leaving this stage if
  `medical_history_status != complete`.
- `clinical_history.incomplete_warns` — warn when `incomplete`; contributes
  risk.

### Cross-stage

- `record.high_risk_requires_review` — when `risk_score >= 75`, require an
  explicit reviewer sign-off before reaching `Ready for Scheduling`.
- `documents.expired` — any attached document with status `expired`
  contributes risk and warns at every stage.

## Why this is not yet implemented

The Phase 1 goal is a clean, opinionated foundation: the data model can
store rules and their evaluations, the API surface can carry rule outcomes
in later phases, and the audit log already captures the structured payload
the engine will produce. Building the engine before the surrounding system
is solid would lock in premature decisions about evaluation order,
extensibility, and explanation formatting.
