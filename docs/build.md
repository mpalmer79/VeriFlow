Build Phase 2 for VeriFlow. This phase is focused on evaluation, rule execution, risk scoring, and workflow transition enforcement. Do not broaden scope beyond that.

Project reminder:
VeriFlow is a workflow intelligence platform that enforces process compliance, detects operational risk, and explains why a record is blocked, warned, or ready to proceed. The first scenario is a healthcare intake and compliance workflow. This is not an EHR, scheduling system, or CRM clone.

Current repo status:
- Phase 0 and Phase 1 are already implemented on main
- Models, auth, record CRUD, seed data, and initial docs already exist
- Schema improvements have already been applied:
  - Rule.code uniqueness is scoped by workflow
  - RuleEvaluation includes passed, action_applied, and risk_applied
  - workflow-stage consistency is enforced in service logic
  - relationships and indexes were improved

Your task in this phase is to implement the first real system intelligence layer.

Primary goals:
1. Rule registry and rule evaluation
2. Risk scoring
3. Evaluation orchestration and persistence
4. Workflow transition enforcement
5. API endpoints for evaluation and transition
6. Strong tests for system behavior

1. Implement a code-driven rule registry

Do not build a visual rule builder.
Do not build a free-form expression parser.
Use a controlled registry pattern.

Create a rule engine service with a registry like this conceptually:
- rule code string maps to a Python evaluator function

Examples:
- identity_required
- insurance_verified_or_self_pay
- consent_required
- guardian_authorization_required
- medical_history_warning
- allergy_warning
- out_of_network_warning

Each evaluator should receive the record and any required related context and return a structured result.

Required result structure:
- passed: boolean
- action_applied: none | warn | block
- message: human-readable explanation
- risk_applied: integer
- rule_code: string

2. Implement the initial rules

Add support for these first rules:

Blocking rules:
- identity_required
  - if identity is not verified, block progression past Identity Verification
- insurance_verified_or_self_pay
  - if insurance is not verified and self-pay is not acknowledged, block progression past Insurance Review
- consent_required
  - if required consent is missing, block progression past Consent & Authorization
- guardian_authorization_required
  - if subject is under 18 and guardian authorization is missing, block progression

Warning rules:
- medical_history_warning
  - if medical history is incomplete, warn but do not block
- allergy_warning
  - if allergy information is blank or incomplete, warn but do not block
- out_of_network_warning
  - if insurance status or coverage indicates out-of-network handling, warn but do not block

Important:
- Implement rules against the current schema as it exists
- If one or two small record fields must be added to support rule clarity, make only minimal necessary schema changes
- Keep the rule logic deterministic and explicit

3. Implement risk scoring

Create a dedicated risk service that:
- aggregates risk_applied values from triggered warnings/blocks
- calculates total risk score
- returns a risk band

Risk bands:
- 0 to 24: low
- 25 to 49: moderate
- 50 to 79: high
- 80+: critical

Use the following baseline scoring:
- identity verification missing: +40
- unresolved insurance: +45
- missing consent: +50
- missing guardian authorization for minor: +60
- incomplete medical history: +15
- missing allergy information: +10
- out-of-network handling: +20

The risk service should return:
- total_score
- risk_band
- summary string if useful

4. Implement evaluation orchestration

Create an evaluation service that:
- loads the record and relevant context
- determines which active rules apply
- runs the rule evaluators
- persists RuleEvaluation rows
- recalculates the record’s risk_score and risk_band
- returns a structured decision payload

Decision payload should include:
- can_progress: boolean
- risk_score: integer
- risk_band: low | moderate | high | critical
- violations: list of blocking issues
- warnings: list of warnings
- summary: concise human-readable explanation

Important:
- clear old evaluation rows for the record before writing the current set, or implement a clean evaluation-run approach
- choose one consistent approach and document it
- do not let stale evaluations accumulate ambiguously

5. Implement workflow transition enforcement

Extend workflow/service logic so that transition attempts are evaluated before progression.

Requirements:
- transition endpoint should accept a target_stage_id
- service validates target stage belongs to same workflow
- service runs evaluation before allowing progression
- if blocking violations exist, the transition is rejected cleanly
- if only warnings exist, progression is allowed
- successful transitions update current_stage_id
- blocked transitions do not update current_stage_id

Add audit logging for:
- transition attempted
- transition blocked
- transition completed
- evaluation executed
- risk recalculated

Do not hardcode route-level logic. Keep this in services.

6. Add API endpoints

Implement:
- POST /api/records/{id}/evaluate
- GET /api/records/{id}/evaluations
- POST /api/records/{id}/transition

Behavior:
- evaluate endpoint returns the current evaluation result
- evaluations endpoint returns persisted evaluation history or current evaluation rows, depending on your chosen design
- transition endpoint attempts a stage transition and returns:
  - success/failure
  - updated stage if successful
  - blocking/warning summary
  - risk score and risk band

7. Seed initial rules

Update seed/demo data so the Healthcare Intake workflow includes the initial rules.

Seed rules with proper:
- code
- name
- description
- severity
- action_type
- risk_weight or equivalent field
- workflow linkage
- stage linkage where appropriate
- active status

Make the seed idempotent.

8. Testing requirements

Add strong pytest coverage for the behavior that makes this product valuable.

Required tests:
- evaluate returns block when identity is missing
- evaluate returns block when insurance is unresolved
- evaluate returns block when consent is missing
- evaluate returns block for minor without guardian authorization
- evaluate returns warning, not block, for incomplete medical history
- evaluate returns warning, not block, for missing allergy information
- evaluate aggregates multiple triggered rules into correct risk score
- transition fails when blocking rules are present
- transition succeeds when only warnings are present
- transition succeeds and updates stage when requirements are satisfied
- audit logs are created for transition attempts and outcomes

These tests should be real and meaningful. Do not reduce everything to mocks if full integration-style tests are reasonable with the current codebase.

9. Documentation updates

Update:
- ARCHITECTURE.md
- docs/workflow_rules.md
- README.md only if needed

Include:
- rule registry approach
- evaluation flow
- risk scoring behavior
- transition enforcement behavior
- note that rules are code-driven in this phase

Do not turn docs into generic filler.

10. Constraints

- Do not build a visual rule builder
- Do not add AI/copilot features
- Do not expand frontend beyond what is necessary to support API contracts if frontend changes are needed at all
- Do not redesign the whole schema unless a very small targeted field addition is required
- Do not introduce background jobs, queues, or microservices
- Keep code clean, production-minded, and maintainable
- Keep comments minimal and human-written
- Preserve service boundaries and separation of concerns

11. Deliverables

At the end of this phase, provide:
- updated backend code
- any required schema/migration changes
- updated seed logic
- updated tests
- updated docs
- brief summary of:
  - what was implemented
  - any schema changes made
  - how evaluation persistence was handled
  - what remains for the next phase

Acceptance criteria:
- rules execute through a registry-based engine
- evaluation endpoint works
- transition endpoint enforces blocking logic
- risk score and risk band are persisted on records
- tests pass
- docs explain the design clearly
