"""Evaluation orchestration and persistence.

This service is the seam between the rule engine, the risk service, and
the database. It owns three responsibilities:

- run every active rule for a record's workflow
- persist the current evaluation set (replacing the previous set) so the
  `rule_evaluations` table always reflects the latest run
- recalculate and persist `risk_score` / `risk_band` on the record

Historical outcomes are preserved through the audit log, which is written
for every evaluation run. Keeping only the current evaluation set in
`rule_evaluations` avoids ambiguity when callers ask "why is this record
blocked right now".
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.enums import RuleActionApplied
from app.models.record import Record
from app.models.rule import RuleEvaluation
from app.models.user import User
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
    rules_by_code = {rule.code: rule for rule in rule_engine_service.load_active_rules(db, record.workflow_id)}
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
    commit: bool = True,
) -> EvaluationDecision:
    """Run evaluation, persist results, recalculate risk, and audit.

    When `commit` is False the caller is responsible for committing; this
    is used by `workflow_service.transition_record` so evaluation and
    transition land in the same transaction.
    """
    results = rule_engine_service.evaluate_record(db, record)
    decision = _build_decision(results)

    _replace_evaluations(db, record, results)

    record.risk_score = decision.risk_score
    record.risk_band = _risk_band_enum(decision.risk_band)
    db.flush()

    audit_service.record_event(
        db,
        action="record.evaluated",
        entity_type="record",
        entity_id=record.id,
        organization_id=record.organization_id,
        actor_user_id=actor.id,
        record_id=record.id,
        payload={
            "rules_evaluated": len(results),
            "violations": [v.rule_code for v in decision.violations],
            "warnings": [w.rule_code for w in decision.warnings],
            "risk_score": decision.risk_score,
            "risk_band": decision.risk_band,
        },
    )
    audit_service.record_event(
        db,
        action="record.risk_recalculated",
        entity_type="record",
        entity_id=record.id,
        organization_id=record.organization_id,
        actor_user_id=actor.id,
        record_id=record.id,
        payload={"risk_score": decision.risk_score, "risk_band": decision.risk_band},
    )

    if commit:
        db.commit()
        db.refresh(record)

    return decision


def _risk_band_enum(value: str):
    from app.models.enums import RiskBand

    return RiskBand(value)


def current_evaluations(db: Session, record: Record) -> List[RuleEvaluation]:
    stmt = (
        select(RuleEvaluation)
        .where(RuleEvaluation.record_id == record.id)
        .order_by(RuleEvaluation.id.asc())
    )
    return list(db.execute(stmt).scalars().all())
