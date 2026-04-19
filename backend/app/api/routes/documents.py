from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.document import (
    DocumentRead,
    DocumentRejectRequest,
    DocumentVerifyRequest,
    IntegrityCheckResponse,
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
    except document_service.DocumentContentMissing as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc
    except document_service.DocumentIntegrityFailure as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc


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


@router.post(
    "/{document_id}/integrity-check",
    response_model=IntegrityCheckResponse,
)
def integrity_check(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        result = document_service.check_integrity(
            db, actor=current_user, document_id=document_id
        )
    except document_service.DocumentNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except document_service.DocumentAccessDenied as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc

    return IntegrityCheckResponse(
        document_id=result.document_id,
        has_stored_content=result.has_stored_content,
        expected_content_hash=result.expected_content_hash,
        actual_content_hash=result.actual_content_hash,
        is_match=result.is_match,
        checked_at=result.checked_at,
        message=result.message,
    )


@router.delete(
    "/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        document_service.delete_document(
            db, actor=current_user, document_id=document_id
        )
    except document_service.DocumentNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except document_service.DocumentAccessDenied as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    return None
