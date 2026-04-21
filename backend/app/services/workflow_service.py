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

from app.models.enums import RiskBand
from app.models.record import Record
from app.models.user import User
from app.repositories import record_repository, workflow_repository
from app.services import audit_service, evaluation_service
from app.services.audit_payloads import (
    risk_recalculated,
    transition_attempted,
    transition_blocked,
    transition_completed,
)
from app.services.evaluation_service import EvaluationDecision
from app.models.workflow import Workflow, WorkflowStage
from app.services.record_service import VersionConflict, get_record


class StageDeletionRefused(Exception):
    """Raised when a caller tries to delete a workflow stage that still
    carries active rules. Cascade-deleting the rules would lose policy
    without an audit trail."""


def get_workflow_for_actor(
    db: Session, actor: User, workflow_id: int
) -> Optional[Workflow]:
    workflow = workflow_repository.get_workflow(db, workflow_id)
    if workflow is None or workflow.organization_id != actor.organization_id:
        return None
    return workflow


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
    return workflow_repository.get_stage_for_workflow(
        db, workflow_id, target_stage_id
    )


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

    # Blocked evaluations must not silently mutate the record row: compute
    # the decision and refresh the persisted evaluation set, but leave
    # `record.risk_score` / `record.risk_band` untouched here. Risk fields
    # are only applied on the successful path below, where a version bump
    # accompanies them.
    decision = evaluation_service.evaluate_and_persist(
        db,
        actor=actor,
        record=record,
        stage_context=target_stage,
        apply_to_record=False,
        commit=False,
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

    # Successful path: apply stage + risk + version in a single mutation.
    prior_risk_score = record.risk_score
    record.current_stage_id = target_stage.id
    record.risk_score = decision.risk_score
    record.risk_band = RiskBand(decision.risk_band)
    record.version = record.version + 1
    record_repository.save(db, record)

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


def delete_stage(db: Session, stage: WorkflowStage) -> None:
    """Delete a workflow stage, refusing when live rules reference it.

    Cascading the rule deletion would quietly drop policy. Callers
    should either move the rules to another stage, deactivate them
    explicitly, or delete them with an audit-aware path before the
    stage is removed.
    """
    from app.models.rule import Rule

    has_rules = db.query(Rule).filter(Rule.stage_id == stage.id).first() is not None
    if has_rules:
        raise StageDeletionRefused(
            f"Stage {stage.id} still has active rules; detach them before deleting the stage."
        )
    db.delete(stage)
    db.flush()
