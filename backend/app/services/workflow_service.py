"""Workflow transition enforcement.

Owns the policy for moving a record from its current stage to a target
stage. Evaluation runs before the transition is committed, and the
transition is rejected if any blocking rule fails. Warnings do not block.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from sqlalchemy.orm import Session

from app.models.record import Record
from app.models.user import User
from app.repositories import record_repository, workflow_repository
from app.services import audit_service, evaluation_service
from app.services.evaluation_service import EvaluationDecision
from app.services.record_service import (
    StageNotFound,
    StageWorkflowMismatch,
    get_record,
)


class TransitionError(Exception):
    pass


@dataclass(frozen=True)
class TransitionResult:
    success: bool
    record: Record
    from_stage_id: int
    target_stage_id: int
    updated_stage_id: int
    decision: EvaluationDecision
    message: str


def _load_target_stage(db: Session, workflow_id: int, target_stage_id: int):
    stage = workflow_repository.get_stage(db, target_stage_id)
    if stage is None:
        raise StageNotFound(f"Stage {target_stage_id} not found")
    if stage.workflow_id != workflow_id:
        raise StageWorkflowMismatch(
            f"Stage {target_stage_id} does not belong to workflow {workflow_id}"
        )
    return stage


def transition_record(
    db: Session,
    *,
    actor: User,
    record_id: int,
    target_stage_id: int,
) -> Optional[TransitionResult]:
    record = get_record(db, actor, record_id)
    if record is None:
        return None

    target_stage = _load_target_stage(db, record.workflow_id, target_stage_id)
    from_stage_id = record.current_stage_id

    audit_service.record_event(
        db,
        action="record.transition_attempted",
        entity_type="record",
        entity_id=record.id,
        organization_id=record.organization_id,
        actor_user_id=actor.id,
        record_id=record.id,
        payload={"from_stage_id": from_stage_id, "target_stage_id": target_stage.id},
    )

    decision = evaluation_service.evaluate_and_persist(
        db, actor=actor, record=record, commit=False
    )

    if not decision.can_progress:
        audit_service.record_event(
            db,
            action="record.transition_blocked",
            entity_type="record",
            entity_id=record.id,
            organization_id=record.organization_id,
            actor_user_id=actor.id,
            record_id=record.id,
            payload={
                "from_stage_id": from_stage_id,
                "target_stage_id": target_stage.id,
                "violations": [v.rule_code for v in decision.violations],
                "risk_score": decision.risk_score,
                "risk_band": decision.risk_band,
            },
        )
        db.commit()
        db.refresh(record)
        return TransitionResult(
            success=False,
            record=record,
            from_stage_id=from_stage_id,
            target_stage_id=target_stage.id,
            updated_stage_id=record.current_stage_id,
            decision=decision,
            message=decision.summary,
        )

    record.current_stage_id = target_stage.id
    record_repository.save(db, record)

    audit_service.record_event(
        db,
        action="record.transition_completed",
        entity_type="record",
        entity_id=record.id,
        organization_id=record.organization_id,
        actor_user_id=actor.id,
        record_id=record.id,
        payload={
            "from_stage_id": from_stage_id,
            "to_stage_id": target_stage.id,
            "warnings": [w.rule_code for w in decision.warnings],
            "risk_score": decision.risk_score,
            "risk_band": decision.risk_band,
        },
    )
    db.commit()
    db.refresh(record)

    return TransitionResult(
        success=True,
        record=record,
        from_stage_id=from_stage_id,
        target_stage_id=target_stage.id,
        updated_stage_id=record.current_stage_id,
        decision=decision,
        message=decision.summary,
    )
