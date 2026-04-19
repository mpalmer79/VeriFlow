from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.services import audit_service

router = APIRouter(prefix="/audit", tags=["audit"])


class AuditChainReport(BaseModel):
    organization_id: Optional[int]
    checked: int
    ok: bool
    broken_entries: List[Dict[str, Any]]
    broken_links: List[Dict[str, Any]]


@router.get("/verify", response_model=AuditChainReport)
def verify_audit_chain(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    report = audit_service.verify_chain(db, current_user.organization_id)
    return AuditChainReport(**report)
