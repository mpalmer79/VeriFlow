from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.workflow import Workflow, WorkflowStage


class StageNotFound(Exception):
    pass


class StageWorkflowMismatch(Exception):
    """Raised when a stage does not belong to the target workflow."""


def get_workflow(db: Session, workflow_id: int) -> Optional[Workflow]:
    stmt = (
        select(Workflow)
        .where(Workflow.id == workflow_id)
        .options(selectinload(Workflow.stages))
    )
    return db.execute(stmt).scalar_one_or_none()


def get_first_stage(db: Session, workflow_id: int) -> Optional[WorkflowStage]:
    stmt = (
        select(WorkflowStage)
        .where(WorkflowStage.workflow_id == workflow_id)
        .order_by(WorkflowStage.order_index.asc())
        .limit(1)
    )
    return db.execute(stmt).scalar_one_or_none()


def get_stage(db: Session, stage_id: int) -> Optional[WorkflowStage]:
    return db.get(WorkflowStage, stage_id)


def get_stage_for_workflow(
    db: Session, workflow_id: int, stage_id: int
) -> WorkflowStage:
    """Load a stage and confirm it belongs to the given workflow.

    Raises StageNotFound when the stage id does not exist,
    StageWorkflowMismatch when the stage exists but belongs to a
    different workflow. Both exceptions are exposed from this module so
    the record and workflow services share one owner for the invariant.
    """
    stage = db.get(WorkflowStage, stage_id)
    if stage is None:
        raise StageNotFound(f"Stage {stage_id} not found")
    if stage.workflow_id != workflow_id:
        raise StageWorkflowMismatch(
            f"Stage {stage_id} does not belong to workflow {workflow_id}"
        )
    return stage
