from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.enums import RecordStatus
from app.models.record import Record
from app.models.user import User
from app.repositories import record_repository, workflow_repository
from app.schemas.record import RecordCreate, RecordUpdate
from app.services import audit_service


class RecordServiceError(Exception):
    pass


class WorkflowNotFound(RecordServiceError):
    pass


class StageNotFound(RecordServiceError):
    pass


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

    first_stage = workflow_repository.get_first_stage(db, workflow.id)
    if first_stage is None:
        raise StageNotFound("Workflow has no stages configured")

    record = Record(
        organization_id=actor.organization_id,
        workflow_id=workflow.id,
        current_stage_id=first_stage.id,
        assigned_user_id=payload.assigned_user_id,
        external_reference=payload.external_reference,
        subject_full_name=payload.subject_full_name,
        subject_dob=payload.subject_dob,
        notes=payload.notes,
        status=RecordStatus.DRAFT,
        insurance_status=payload.insurance_status,
        consent_status=payload.consent_status,
        medical_history_status=payload.medical_history_status,
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
        payload={"workflow_id": workflow.id, "stage_id": first_stage.id},
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

    changes = payload.model_dump(exclude_unset=True)

    if "current_stage_id" in changes and changes["current_stage_id"] is not None:
        stage = workflow_repository.get_stage(db, changes["current_stage_id"])
        if stage is None or stage.workflow_id != record.workflow_id:
            raise StageNotFound("Stage does not belong to this record's workflow")

    for field, value in changes.items():
        setattr(record, field, value)

    record = record_repository.save(db, record)
    audit_service.record_event(
        db,
        action="record.updated",
        entity_type="record",
        entity_id=record.id,
        organization_id=actor.organization_id,
        actor_user_id=actor.id,
        record_id=record.id,
        payload={"changes": list(changes.keys())},
    )
    db.commit()
    db.refresh(record)
    return record
