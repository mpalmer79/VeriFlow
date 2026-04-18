from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.document import (
    DocumentRead,
    DocumentRejectRequest,
    DocumentVerifyRequest,
)
from app.services import document_service

router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("/{document_id}/verify", response_model=DocumentRead)
def verify_document(
    document_id: int,
    payload: DocumentVerifyRequest | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return document_service.verify_document(
            db,
            actor=current_user,
            document_id=document_id,
            notes=payload.notes if payload else None,
        )
    except document_service.DocumentNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except document_service.DocumentAccessDenied as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc


@router.post("/{document_id}/reject", response_model=DocumentRead)
def reject_document(
    document_id: int,
    payload: DocumentRejectRequest | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return document_service.reject_document(
            db,
            actor=current_user,
            document_id=document_id,
            reason=payload.reason if payload else None,
        )
    except document_service.DocumentNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except document_service.DocumentAccessDenied as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
