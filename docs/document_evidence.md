# VeriFlow — Document Evidence

Phase 3 introduced document evidence as a first-class input to rule
evaluation. This document explains the model, the lifecycle, how rules
consume it, and how required documents are determined per record.

## Model

### `Document`

A `Document` row represents a single piece of evidence attached to a
record. The schema captures the full verification lifecycle, not just
metadata:

| Field                     | Notes                                                 |
|---------------------------|-------------------------------------------------------|
| `record_id`               | FK to the record                                      |
| `document_type`           | normalized enum (`DocumentType`)                      |
| `label`                   | free-form human label (e.g. "Driver's license scan")  |
| `storage_uri`             | optional pointer to object storage (placeholder)      |
| `status`                  | `uploaded`, `verified`, `rejected`, `expired`         |
| `notes`                   | reviewer notes                                        |
| `verified_by_user_id` / `verified_at`     | set when verified          |
| `rejected_by_user_id` / `rejected_at` / `rejection_reason` | set when rejected |
| `created_at` / `updated_at` | standard timestamps                                 |

`DocumentType` is an enum so document kinds are normalized across the
system (`photo_id`, `insurance_card`, `consent_form`,
`guardian_authorization`, `medical_history_form`, `other`).

`DocumentStatus` values:
- `uploaded` — document present, not yet reviewed
- `verified` — reviewer has confirmed the document
- `rejected` — reviewer has rejected the document; `rejection_reason`
  captures why
- `expired` — reserved for future use; not emitted by Phase 3 flows

"Missing" is **not** a persisted status. A document is missing when a
requirement exists and no non-rejected `Document` row of that type is
attached to the record.

### `DocumentRequirement`

A `DocumentRequirement` row declares that a workflow (optionally scoped
to a stage) requires a given document type:

| Field                 | Notes                                                 |
|-----------------------|-------------------------------------------------------|
| `workflow_id`         | required                                              |
| `stage_id`            | optional; null = workflow-global                      |
| `document_type`       | `DocumentType`                                        |
| `is_required`         | bool                                                  |
| `applies_when_code`   | reserved for future conditional logic (see below)     |

Uniqueness is enforced with **two partial unique indexes** so the
nullable `stage_id` cannot allow duplicate workflow-global rows in
PostgreSQL (where NULLs are treated as distinct in standard unique
constraints):

- `uq_doc_req_workflow_global_type` — when `stage_id IS NULL`, unique
  on `(workflow_id, document_type)`
- `uq_doc_req_workflow_stage_type` — when `stage_id IS NOT NULL`,
  unique on `(workflow_id, stage_id, document_type)`

Both are emitted with `postgresql_where` and `sqlite_where` predicates
so PostgreSQL in production and SQLite in tests reject duplicates at
the database layer with an `IntegrityError`. The service layer does not
need to pre-check.

## Required-document logic

`document_service.required_document_types(record)` returns the document
types that are currently required for a record. A requirement applies
when:

- `is_required` is true, **and**
- the requirement is either workflow-global (`stage_id` null) or scoped
  to a stage at or before the record's current stage (`order_index`).

This mirrors the evaluation policy: once a record has reached stage X,
every requirement attached to any stage up to and including X is in
scope.

### Conditional requirements (reserved, not yet active)

`applies_when_code` is a forward-compatibility column. It is not
interpreted in Phase 3. For example, `guardian_authorization` is marked
`applies_when_code = "subject_is_minor"` in the seed so the schema
records the intent, but the *actual* minor check still lives in
`guardian_authorization_required`'s Python evaluator. A later phase may
introduce a small, controlled resolver for these codes without a DSL.

## Document status endpoint

`GET /api/records/{id}/document-status` returns an explicit, non-
overlapping view of the record's document evidence. A requirement is
satisfied **only** by a verified document; an uploaded-but-not-yet-
verified document is not enough.

- `required_types` — types required at the record's current stage
- `present_types` — types with at least one non-rejected document
  (present does not imply verified)
- `verified_types` — types with at least one verified document
- `satisfied_types` — required types whose requirement is met
  (`required ∩ verified`)
- `missing_types` — required types whose requirement is not met
  (`required − verified`)
- `rejected_types` — types with at least one rejected document. This is
  historical information; a type can appear here alongside
  `verified_types` when a record has both a rejected and a later
  verified document.
- `documents` — the full `Document` rows for display

The invariant `required_types = satisfied_types + missing_types` always
holds, so API callers can rely on these sets as a partition of the
requirement surface. A required type whose only evidence is uploaded
(not yet verified) appears in `present_types` and in `missing_types` —
the document is on file, but the requirement is not yet satisfied.

## Hybrid rule evaluation

Several Phase 2 rules now consider document evidence alongside the
existing record flags:

| Rule | Document evidence | Legacy signal |
|------|-------------------|----------------|
| `identity_required` | verified `photo_id` | `record.identity_verified` |
| `insurance_verified_or_self_pay` | verified `insurance_card` | `insurance_status` in {`verified`, `uninsured_acknowledged`} |
| `consent_required` | verified `consent_form` | `consent_status == signed` |
| `guardian_authorization_required` | verified `guardian_authorization` | `guardian_authorization_signed` (only for minors) |
| `medical_history_warning` | verified `medical_history_form` | `medical_history_status == complete` |

Each rule passes when **either** the document evidence is present and
verified **or** the legacy signal is set. The hybrid is intentional: it
keeps demo records meaningful without documents attached, and it lets
callers adopt document evidence gradually.

`allergy_warning` and `out_of_network_warning` remain non-document rules
in Phase 3.

## Stage-aware evaluation

`rule_engine_service.applicable_rules` filters the active rules for a
workflow against a `stage_context`:

- workflow-global rules (`stage_id` is null) always apply
- stage-gated rules apply when the stage's `order_index` is `<=` the
  context's `order_index`

Contexts:
- `evaluation_service.evaluate_and_persist(stage_context=None)` uses the
  record's current stage — "is the record consistent with being here?"
- `workflow_service.transition_record(target_stage_id=X)` uses `X` as
  the context — "can the record enter X given everything up to and
  including X?"

## Audit payloads

Audit payloads for every event listed below share a stable shape. See
`app/services/audit_payloads.py` for the canonical builders.

- `record.evaluated` — `record_id`, `current_stage_id`, `stage_context_id`,
  `rules_evaluated`, `blocking_rule_codes`, `warning_rule_codes`,
  `risk_score`, `risk_band`
- `record.risk_recalculated` — `record_id`, `prior_risk_score`,
  `new_risk_score`, `risk_band`
- `record.transition_attempted` — `record_id`, `current_stage_id`,
  `target_stage_id`
- `record.transition_blocked` — `record_id`, `current_stage_id`,
  `target_stage_id`, `blocking_rule_codes`, `warning_rule_codes`,
  `risk_score`, `risk_band`
- `record.transition_completed` — `record_id`, `prior_stage_id`,
  `new_stage_id`, `warning_rule_codes`, `risk_score`, `risk_band`
- `document.uploaded` — `record_id`, `document_id`, `document_type`,
  `document_status`
- `document.verified` — adds `verified_by`
- `document.rejected` — adds `rejected_by`, `rejection_reason`

## API surface added in Phase 3

- `GET /api/records/{id}/documents` — list documents for a record
- `POST /api/records/{id}/documents` — upload a document metadata entry
- `GET /api/records/{id}/document-status` — required vs present status
- `POST /api/documents/{id}/verify` — mark a document verified
- `POST /api/documents/{id}/reject` — mark a document rejected with an
  optional reason

## Why this matters

Without document evidence, rules collapsed to "is the flag set?" — which
is thin and hard to audit. Evidence makes decisions traceable: when a
record is blocked, the response names the rule, the reviewer can check
the rejected document attached to the record, and the audit log has a
`document.rejected` event with the reason. Combined with stage-aware
filtering, transitions now reflect the actual policy of the workflow
rather than a blanket rule sweep.
