Phase 2 is committed (`5071eab`) and pushed to `claude/veriflow-phase-0-1-fNDG6`. All 38 tests pass (5 auth + 8 integrity + 7 records + 18 evaluation).

## Summary

### What was implemented

**Rule engine (code-driven registry):**
- `rule_engine_service.py` — `RuleResult` dataclass, `@register(code)` decorator, `evaluate_record(db, record)` entry point. Rule definitions are data (in DB); evaluation logic is Python.
- `rules.py` — seven built-in evaluators: `identity_required`, `insurance_verified_or_self_pay`, `consent_required`, `guardian_authorization_required`, `medical_history_warning`, `allergy_warning`, `out_of_network_warning`.
- Evaluators read the rule's configured `action` / `risk_weight` so the same evaluator is reusable across workflows.

**Risk scoring:** `risk_service.py` — pure function; thresholds centralized (low 0–24, moderate 25–49, high 50–79, critical 80+).

**Evaluation orchestration:** `evaluation_service.py` — runs engine → aggregates risk → replaces the record's `rule_evaluations` → updates `risk_score`/`risk_band` → writes `record.evaluated` + `record.risk_recalculated` audit events.

**Transitions:** `workflow_service.transition_record` — validates stage ∈ workflow, runs evaluation in the same transaction, rejects on any `BLOCK` failure. Audit events: `transition_attempted`, `transition_blocked`, `transition_completed`.

**API:** `POST /api/records/{id}/evaluate`, `GET /api/records/{id}/evaluations`, `POST /api/records/{id}/transition`.

### Schema changes (minimal, additive)

Four new fields on `Record` needed to express the seven rules cleanly:
- `identity_verified: bool`
- `guardian_authorization_signed: bool`
- `allergy_info_provided: bool`
- `insurance_in_network: Optional[bool]`

Seeded rules align 1:1 with registered evaluators, idempotently.

### How evaluation persistence was handled

**Current-state, not history.** Each evaluation run replaces the record's `rule_evaluations` rows so the table always reflects the most recent outcome. Long-term history is captured in the append-only audit log. Rationale: unambiguous answer to "why is this record blocked right now," with no accumulation drift.

### What remains for next phase

- Document workflow (`document_service`, attachments, status transitions, document-driven rules).
- Stage-aware rule filtering (a rule row carries `stage_id` today as advisory metadata; a future phase can gate evaluators on current vs. target stage rather than running the full set).
- Reporting/analytics (aggregate risk over time, rule-trigger frequency, bottleneck detection).
- Frontend surface for the decision payload and audit timeline.
