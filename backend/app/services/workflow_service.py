"""Workflow transition enforcement.

Owns the policy for moving a record from its current stage to a target
stage. Evaluation runs before the transition is committed, against the
**target stage context** so a transition to a later stage pulls in every
rule up to and including that stage. If any blocking rule fails, the
transition is rejected; warnings do not block.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from sqlalchemy.orm import Session

from app.models.record import Record
from app.models.user import User
from app.repositories import record_repository, workflow_repository
from app.services import audit_service, evaluation_service
from app.services.audit_payloads import (
    transition_attempted,
    transition_blocked,
    transition_completed,
)
from app.services.evaluation_service import EvaluationDecision
from app.services.record_service import (
    StageNotFound,
    StageWorkflowMismatch,
    VersionConflict,
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
    record_version: int
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
    expected_version: int,
) -> Optional[TransitionResult]:
    record = get_record(db, actor, record_id)
    if record is None:
        return None

    if record.version != expected_version:
        raise VersionConflict(
            record_id=record.id,
            expected=expected_version,
            current=record.version,
        )

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
        payload=transition_attempted(
            record_id=record.id,
            current_stage_id=from_stage_id,
            target_stage_id=target_stage.id,
        ),
    )

    decision = evaluation_service.evaluate_and_persist(
        db,
        actor=actor,
        record=record,
        stage_context=target_stage,
        commit=False,
    )

    if not decision.can_progress:
        # Risk fields may have been recomputed during evaluation; that is a
        # system-driven side effect, not a caller-visible mutation, so the
        # version is deliberately left unchanged on a blocked transition.
        audit_service.record_event(
            db,
            action="record.transition_blocked",
            entity_type="record",
            entity_id=record.id,
            organization_id=record.organization_id,
            actor_user_id=actor.id,
            record_id=record.id,
            payload=transition_blocked(
                record_id=record.id,
                current_stage_id=from_stage_id,
                target_stage_id=target_stage.id,
                decision=decision,
            ),
        )
        db.commit()
        db.refresh(record)
        return TransitionResult(
            success=False,
            record=record,
            from_stage_id=from_stage_id,
            target_stage_id=target_stage.id,
            updated_stage_id=record.current_stage_id,
            record_version=record.version,
            decision=decision,
            message=decision.summary,
        )

    record.current_stage_id = target_stage.id
    record.version = record.version + 1
    record_repository.save(db, record)

    audit_service.record_event(
        db,
        action="record.transition_completed",
        entity_type="record",
        entity_id=record.id,
        organization_id=record.organization_id,
        actor_user_id=actor.id,
        record_id=record.id,
        payload=transition_completed(
            record_id=record.id,
            prior_stage_id=from_stage_id,
            new_stage_id=target_stage.id,
            decision=decision,
        ),
    )
    db.commit()
    db.refresh(record)

    return TransitionResult(
        success=True,
        record=record,
        from_stage_id=from_stage_id,
        target_stage_id=target_stage.id,
        updated_stage_id=record.current_stage_id,
        record_version=record.version,
        decision=decision,
        message=decision.summary,
    )
