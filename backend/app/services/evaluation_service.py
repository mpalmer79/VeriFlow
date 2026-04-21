"""Evaluation orchestration and persistence.

This service is the seam between the rule engine, the risk service, and
the database. It owns three responsibilities:

- run every applicable rule for a record at a given stage context
- persist the current evaluation set (replacing the previous set) so the
  `rule_evaluations` table always reflects the latest run
- recalculate and persist `risk_score` / `risk_band` on the record

The `rule_evaluations` table is **current state, not history**. Long-term
history lives in the append-only audit log (`record.evaluated`,
`record.risk_recalculated`, `record.transition_*`).
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import List, Optional

from sqlalchemy import delete, select
from sqlalchemy.orm import Session, selectinload

from app.core import metrics
from app.models.enums import RiskBand, RuleActionApplied
from app.models.record import Record
from app.models.rule import RuleEvaluation
from app.models.user import User
from app.models.workflow import WorkflowStage
from app.services import audit_service, rule_engine_service, risk_service
from app.services.rule_engine_service import RuleResult


@dataclass(frozen=True)
class EvaluationIssue:
    rule_code: str
    message: str
    risk_applied: int


@dataclass(frozen=True)
class EvaluationDecision:
    can_progress: bool
    risk_score: int
    risk_band: str
    violations: List[EvaluationIssue]
    warnings: List[EvaluationIssue]
    summary: str


def _to_issue(result: RuleResult) -> EvaluationIssue:
    return EvaluationIssue(
        rule_code=result.rule_code,
        message=result.message,
        risk_applied=result.risk_applied,
    )


def _build_decision(results: List[RuleResult]) -> EvaluationDecision:
    risk = risk_service.compute(results)

    violations = [
        _to_issue(r) for r in results if r.action_applied == RuleActionApplied.BLOCK
    ]
    warnings = [
        _to_issue(r) for r in results if r.action_applied == RuleActionApplied.WARN
    ]
    can_progress = not violations

    if not results:
        summary = "No active rules configured; progression allowed."
    elif violations:
        summary = (
            f"{len(violations)} blocking issue(s); {len(warnings)} warning(s); "
            f"risk {risk.total_score} ({risk.risk_band.value})."
        )
    elif warnings:
        summary = (
            f"No blocking issues; {len(warnings)} warning(s); "
            f"risk {risk.total_score} ({risk.risk_band.value})."
        )
    else:
        summary = f"All rules passed; risk {risk.total_score} ({risk.risk_band.value})."

    return EvaluationDecision(
        can_progress=can_progress,
        risk_score=risk.total_score,
        risk_band=risk.risk_band.value,
        violations=violations,
        warnings=warnings,
        summary=summary,
    )


def _replace_evaluations(db: Session, record: Record, results: List[RuleResult]) -> None:
    db.execute(delete(RuleEvaluation).where(RuleEvaluation.record_id == record.id))
    rules_by_code = {
        rule.code: rule
        for rule in rule_engine_service.load_active_rules(db, record.workflow_id)
    }
    for result in results:
        rule = rules_by_code.get(result.rule_code)
        if rule is None:
            continue
        db.add(
            RuleEvaluation(
                record_id=record.id,
                rule_id=rule.id,
                passed=result.passed,
                action_applied=result.action_applied,
                risk_applied=result.risk_applied,
                explanation=result.message,
            )
        )
    db.flush()


def evaluate_and_persist(
    db: Session,
    *,
    actor: User,
    record: Record,
    stage_context: Optional[WorkflowStage] = None,
    apply_to_record: bool = True,
    commit: bool = True,
) -> EvaluationDecision:
    """Run evaluation, persist the evaluation rows, and optionally mutate
    the record's risk fields.

    `stage_context` selects which rules apply. Defaults to the record's
    current stage; transitions pass the target stage so rules for stages
    the record is about to enter come into scope.

    `apply_to_record=False` (used by `workflow_service.transition_record`)
    computes the decision and refreshes `rule_evaluations`, but leaves
    `record.risk_score` / `record.risk_band` unchanged. This avoids the
    Phase 1 leak where blocked transitions silently mutated record row
    state without touching `record.version`.

    When `commit=False` the caller is responsible for committing.
    """
    # Import locally to avoid a circular import through rule_engine_service.
    from app.services.audit_payloads import record_evaluated, risk_recalculated

    started = time.perf_counter()
    results = rule_engine_service.evaluate_record(
        db, record, stage_context=stage_context
    )
    decision = _build_decision(results)

    _replace_evaluations(db, record, results)

    prior_risk_score = record.risk_score
    if apply_to_record:
        record.risk_score = decision.risk_score
        record.risk_band = RiskBand(decision.risk_band)
    db.flush()

    effective_context = stage_context or record.current_stage
    audit_service.record_event(
        db,
        action="record.evaluated",
        entity_type="record",
        entity_id=record.id,
        organization_id=record.organization_id,
        actor_user_id=actor.id,
        record_id=record.id,
        payload=record_evaluated(
            record_id=record.id,
            current_stage_id=record.current_stage_id,
            stage_context_id=effective_context.id if effective_context else None,
            rules_evaluated=len(results),
            decision=decision,
        ),
    )
    if apply_to_record:
        audit_service.record_event(
            db,
            action="record.risk_recalculated",
            entity_type="record",
            entity_id=record.id,
            organization_id=record.organization_id,
            actor_user_id=actor.id,
            record_id=record.id,
            payload=risk_recalculated(
                record_id=record.id,
                prior_risk_score=prior_risk_score,
                new_risk_score=decision.risk_score,
                risk_band=decision.risk_band,
            ),
        )

    if commit:
        db.commit()
        db.refresh(record)

    metrics.observe_evaluation(time.perf_counter() - started)
    return decision


def current_evaluations(db: Session, record: Record) -> List[RuleEvaluation]:
    stmt = (
        select(RuleEvaluation)
        .where(RuleEvaluation.record_id == record.id)
        .options(selectinload(RuleEvaluation.rule))
        .order_by(RuleEvaluation.id.asc())
    )
    return list(db.execute(stmt).scalars().all())
