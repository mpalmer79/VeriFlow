Build Phase 3 for VeriFlow. This phase is focused on document evidence, document verification workflow, required-document logic, and stage-aware rule evaluation. Do not broaden scope beyond that.

Project reminder:
VeriFlow is a workflow intelligence platform that enforces process compliance, detects operational risk, and explains why a record is blocked, warned, or ready to proceed. The first scenario is a healthcare intake and compliance workflow. This is not an EHR, scheduling system, or CRM clone.

Current repo status:
- Phase 0 and Phase 1 are already on main
- Phase 2 is implemented with:
  - code-driven rule registry
  - seven initial evaluators
  - risk scoring
  - evaluation orchestration
  - transition enforcement
  - evaluation and transition APIs
  - tests passing
- Current limitation:
  - several rules still depend on boolean fields on Record instead of stronger document evidence
  - all rules likely run too broadly instead of being filtered by stage context

This phase should make the system feel more real by connecting rule decisions to document evidence and stage relevance.

Primary goals:
1. Strengthen document behavior and verification workflow
2. Introduce required-document logic
3. Make rules document-aware where appropriate
4. Add stage-aware rule filtering
5. Improve audit payload consistency
6. Add tests that prove the system uses evidence rather than shallow flags

1. Extend document handling into a real evidence layer

Use the existing Document model and service structure if already present. Expand behavior so documents are meaningful system evidence, not just metadata rows.

Required document capabilities:
- support document lifecycle states clearly:
  - missing
  - uploaded
  - verified
  - rejected
- support verifier identity and timestamps
- allow document notes or rejection reasons
- maintain normalized document types

If current schema is close, make only targeted changes. Do not redesign everything unnecessarily.

At minimum, the service layer should support:
- listing documents for a record
- uploading/creating a document metadata entry
- marking a document as verified
- marking a document as rejected
- retrieving required vs existing document status for a record

2. Implement required-document logic

Add a document requirement concept without overengineering.

Acceptable MVP approaches:
- a small DocumentRequirement model tied to workflow and optionally stage and document_type
or
- a tightly scoped equivalent design that is still data-driven

Recommended fields if a model is added:
- id
- workflow_id
- stage_id nullable
- document_type
- is_required
- applies_when_code nullable or future-safe metadata
- created_at

Keep it simple. Do not build a full conditional rules DSL here.

Behavior:
- the system must be able to answer:
  - which documents are required for this record right now
  - which are present
  - which are verified
  - which are missing or rejected

Seed the Healthcare Intake workflow with document requirements such as:
- photo_id
- insurance_card
- consent_form
- guardian_authorization
- medical_history_form

3. Make rules document-aware where appropriate

Update the relevant existing rules so they use document evidence instead of only relying on booleans where appropriate.

Priority rule changes:
- identity_required should prefer verified photo_id document evidence
- consent_required should prefer verified or accepted consent_form document evidence
- guardian_authorization_required should prefer verified guardian_authorization document evidence
- insurance_verified_or_self_pay should consider insurance_card presence/verification where appropriate, while preserving current insurance status logic
- medical_history_warning should consider medical_history_form presence or completion signal if that fits the current schema cleanly

Important:
- Do not force every rule to be document-only if the current schema still needs hybrid logic
- It is acceptable to use both document evidence and existing record fields during this phase
- But document evidence must become first-class for the rules where it clearly belongs

4. Implement stage-aware rule filtering

Current problem:
Rules are likely evaluated too broadly.

Required improvement:
- rules should be filtered based on workflow and stage context
- support evaluating:
  - current stage context
  - target stage context during transition attempts

Minimum expected behavior:
- if a rule has a stage_id, it should apply only when that stage is relevant
- workflow-wide rules with no stage_id may still apply globally within the workflow

Recommended evaluation behavior:
- evaluation endpoint can evaluate against current stage context
- transition endpoint can evaluate against target stage context, so progression can be blocked by rules tied to the stage being entered or passed

Document your chosen stage-filtering behavior clearly in code and docs.

5. Improve audit payload consistency

Standardize audit payload structures for at least these events:
- record.evaluated
- record.risk_recalculated
- transition_attempted
- transition_blocked
- transition_completed
- document_uploaded
- document_verified
- document_rejected

Each payload should be structured and consistent, not ad hoc.

Examples of useful fields:
- record_id
- current_stage_id
- target_stage_id
- prior_stage_id
- prior_risk_score
- new_risk_score
- risk_band
- blocking_rule_codes
- warning_rule_codes
- document_type
- document_status
- verified_by
- rejection_reason

Do not add generic filler payloads. Make them useful for future analysis and traceability.

6. Add or refine API endpoints

Implement or refine endpoints as needed:

Documents:
- GET /api/records/{id}/documents
- POST /api/records/{id}/documents
- POST /api/documents/{id}/verify
- POST /api/documents/{id}/reject

Requirements/status:
- GET /api/records/{id}/document-status

Behavior:
- document-status endpoint should summarize:
  - required document types
  - present document types
  - verified document types
  - missing document types
  - rejected document types

Keep responses clean and useful for a later frontend.

7. Seed document requirements and realistic demo state

Update seed logic idempotently so demo data includes:
- document requirements for the Healthcare Intake workflow
- demo records with varied document states:
  - some missing
  - some uploaded but not verified
  - some verified
  - some rejected

This matters because later screenshots and demo flows need realistic evidence states.

8. Testing requirements

Add strong pytest coverage for document evidence and stage-aware evaluation.

Required tests:
- identity rule passes when verified photo_id exists
- identity rule blocks when required identity document is missing
- consent rule passes when consent_form is present in acceptable state
- guardian authorization rule blocks minor without verified guardian authorization
- guardian authorization rule passes for adult even if guardian document is absent
- transition evaluates rules using target stage context, not only current stage
- document-status endpoint correctly reports missing, present, verified, and rejected documents
- rejecting a required document affects evaluation outcome appropriately
- verifying a required document can unblock progression when all other requirements are satisfied
- audit logs are written for document upload, verification, and rejection with structured payloads

Tests should be meaningful and reflect actual service behavior. Do not reduce the phase to superficial endpoint smoke tests.

9. Documentation updates

Update:
- ARCHITECTURE.md
- docs/workflow_rules.md
- README.md only if needed
- add docs/document_evidence.md if helpful

Docs should clearly explain:
- document evidence model
- required-document approach
- hybrid rule evaluation where applicable
- stage-aware rule filtering
- current-state evaluation behavior vs audit history
- why this phase improves explainability and realism

Do not write vague architecture filler.

10. Constraints

- Do not build file storage integration beyond metadata and state management unless the current codebase already has a clean placeholder pattern
- Do not add AI features
- Do not build a no-code admin builder
- Do not expand frontend significantly
- Do not redesign the whole schema unless changes are tightly scoped and justified
- Keep service boundaries clean
- Keep comments minimal and human-written
- Keep the project production-minded, not tutorial-like

11. Deliverables

At the end of this phase, provide:
- updated backend code
- any required schema/model changes
- updated seed logic
- updated tests
- updated docs
- brief summary of:
  - what document evidence changes were made
  - how required documents are modeled
  - how stage-aware rule filtering works
  - which rules are now document-aware
  - what remains for the next phase

Acceptance criteria:
- documents act as real evidence in the workflow
- required document status can be computed per record
- key rules use document evidence where appropriate
- transition evaluation is stage-aware
- audit payloads are consistent and useful
- tests pass
- docs clearly explain the design
