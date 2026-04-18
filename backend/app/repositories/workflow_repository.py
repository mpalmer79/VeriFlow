from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.workflow import Workflow, WorkflowStage


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
