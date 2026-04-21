from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.workflow import WorkflowRead
from app.services import workflow_service

router = APIRouter(prefix="/workflows", tags=["workflows"])


@router.get("/{workflow_id}", response_model=WorkflowRead)
def get_workflow(
    workflow_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    workflow = workflow_service.get_workflow_for_actor(db, current_user, workflow_id)
    if workflow is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found")
    return workflow
