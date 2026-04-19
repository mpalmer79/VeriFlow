from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.enums import RecordStatus
from app.models.record import Record
from app.models.user import User
from app.models.workflow import WorkflowStage
from app.repositories import record_repository, workflow_repository
from app.schemas.record import RecordCreate, RecordUpdate
from app.services import audit_service


class RecordServiceError(Exception):
    pass


class WorkflowNotFound(RecordServiceError):
    pass


class StageNotFound(RecordServiceError):
    pass


class StageWorkflowMismatch(RecordServiceError):
    """Raised when a stage does not belong to the target workflow."""


class VersionConflict(RecordServiceError):
    """Raised when a mutation's `expected_version` does not match the persisted row."""

    def __init__(self, record_id: int, expected: int, current: int) -> None:
        super().__init__(
            f"Record {record_id} version mismatch: expected {expected}, current {current}"
        )
        self.record_id = record_id
        self.expected_version = expected
        self.current_version = current


def _load_stage_for_workflow(
    db: Session, workflow_id: int, stage_id: int
) -> WorkflowStage:
    stage = workflow_repository.get_stage(db, stage_id)
    if stage is None:
        raise StageNotFound(f"Stage {stage_id} not found")
    if stage.workflow_id != workflow_id:
        raise StageWorkflowMismatch(
            f"Stage {stage_id} does not belong to workflow {workflow_id}"
        )
    return stage


def list_records(db: Session, actor: User, limit: int = 100, offset: int = 0) -> List[Record]:
    return record_repository.list_for_organization(
        db, organization_id=actor.organization_id, limit=limit, offset=offset
    )


def get_record(db: Session, actor: User, record_id: int) -> Optional[Record]:
    record = record_repository.get(db, record_id)
    if record is None or record.organization_id != actor.organization_id:
        return None
    return record


def create_record(db: Session, actor: User, payload: RecordCreate) -> Record:
    workflow = workflow_repository.get_workflow(db, payload.workflow_id)
    if workflow is None or workflow.organization_id != actor.organization_id:
        raise WorkflowNotFound("Workflow not found for this organization")

    if payload.current_stage_id is not None:
        stage = _load_stage_for_workflow(db, workflow.id, payload.current_stage_id)
    else:
        stage = workflow_repository.get_first_stage(db, workflow.id)
        if stage is None:
            raise StageNotFound("Workflow has no stages configured")

    record = Record(
        organization_id=actor.organization_id,
        workflow_id=workflow.id,
        current_stage_id=stage.id,
        assigned_user_id=payload.assigned_user_id,
        external_reference=payload.external_reference,
        subject_full_name=payload.subject_full_name,
        subject_dob=payload.subject_dob,
        notes=payload.notes,
        status=RecordStatus.DRAFT,
        insurance_status=payload.insurance_status,
        consent_status=payload.consent_status,
        medical_history_status=payload.medical_history_status,
        identity_verified=payload.identity_verified,
        guardian_authorization_signed=payload.guardian_authorization_signed,
        allergy_info_provided=payload.allergy_info_provided,
        insurance_in_network=payload.insurance_in_network,
    )

    record = record_repository.add(db, record)
    audit_service.record_event(
        db,
        action="record.created",
        entity_type="record",
        entity_id=record.id,
        organization_id=actor.organization_id,
        actor_user_id=actor.id,
        record_id=record.id,
        payload={"workflow_id": workflow.id, "stage_id": stage.id},
    )
    db.commit()
    db.refresh(record)
    return record


def update_record(
    db: Session, actor: User, record_id: int, payload: RecordUpdate
) -> Optional[Record]:
    record = get_record(db, actor, record_id)
    if record is None:
        return None

    if record.version != payload.expected_version:
        raise VersionConflict(
            record_id=record.id,
            expected=payload.expected_version,
            current=record.version,
        )

    changes = payload.model_dump(exclude_unset=True, exclude={"expected_version"})

    new_stage_id = changes.get("current_stage_id")
    if new_stage_id is not None:
        _load_stage_for_workflow(db, record.workflow_id, new_stage_id)

    for field, value in changes.items():
        setattr(record, field, value)

    record.version = record.version + 1
    record = record_repository.save(db, record)
    audit_service.record_event(
        db,
        action="record.updated",
        entity_type="record",
        entity_id=record.id,
        organization_id=actor.organization_id,
        actor_user_id=actor.id,
        record_id=record.id,
        payload={
            "changes": list(changes.keys()),
            "new_version": record.version,
        },
    )
    db.commit()
    db.refresh(record)
    return record
