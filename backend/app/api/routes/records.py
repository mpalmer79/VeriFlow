from datetime import datetime
from typing import List, Optional

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from sqlalchemy.orm import Session

from app.core import evidence_storage
from app.core.config import get_settings
from app.core.rate_limit import rate_limit
from app.models.enums import DocumentType

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.audit import AuditEntryRead
from app.schemas.document import (
    DocumentCreate,
    DocumentRead,
    DocumentStatusResponse,
    EvidenceSummaryResponse,
    IntegrityCheckResponse,
    RecordIntegritySummaryResponse,
)
from app.schemas.evaluation import (
    EvaluationDecisionRead,
    EvaluationIssue as EvaluationIssueSchema,
    RuleEvaluationRead,
    TransitionRequest,
    TransitionResponse,
)
from app.schemas.record import RecordCreate, RecordRead, RecordUpdate
from app.services import (
    document_service,
    evaluation_service,
    record_service,
    workflow_service,
)

router = APIRouter(prefix="/records", tags=["records"])


def _decision_to_schema(decision) -> EvaluationDecisionRead:
    return EvaluationDecisionRead(
        can_progress=decision.can_progress,
        risk_score=decision.risk_score,
        risk_band=decision.risk_band,
        violations=[EvaluationIssueSchema(**v.__dict__) for v in decision.violations],
        warnings=[EvaluationIssueSchema(**w.__dict__) for w in decision.warnings],
        summary=decision.summary,
    )


@router.get("", response_model=List[RecordRead])
def list_records(
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return record_service.list_records(db, current_user, limit=limit, offset=offset)


@router.post("", response_model=RecordRead, status_code=status.HTTP_201_CREATED)
def create_record(
    payload: RecordCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return record_service.create_record(db, current_user, payload)
    except record_service.WorkflowNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except (record_service.StageNotFound, record_service.StageWorkflowMismatch) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/{record_id}", response_model=RecordRead)
def get_record(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    record = record_service.get_record(db, current_user, record_id)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")
    return record


@router.patch("/{record_id}", response_model=RecordRead)
def update_record(
    record_id: int,
    payload: RecordUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        record = record_service.update_record(db, current_user, record_id, payload)
    except (record_service.StageNotFound, record_service.StageWorkflowMismatch) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except record_service.VersionConflict as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")
    return record


@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_record(
    record_id: int,
    expected_version: int = Query(..., ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        deleted = record_service.delete_record(
            db,
            actor=current_user,
            record_id=record_id,
            expected_version=expected_version,
        )
    except record_service.VersionConflict as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")
    return None


@router.post("/{record_id}/evaluate", response_model=EvaluationDecisionRead)
def evaluate_record(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    record = record_service.get_record(db, current_user, record_id)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")

    decision = evaluation_service.evaluate_and_persist(
        db, actor=current_user, record=record
    )
    return _decision_to_schema(decision)


@router.get("/{record_id}/evaluations", response_model=List[RuleEvaluationRead])
def list_evaluations(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    record = record_service.get_record(db, current_user, record_id)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")

    return evaluation_service.current_evaluations(db, record)


@router.post("/{record_id}/transition", response_model=TransitionResponse)
def transition_record(
    record_id: int,
    payload: TransitionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        result = workflow_service.transition_record(
            db,
            actor=current_user,
            record_id=record_id,
            target_stage_id=payload.target_stage_id,
            expected_version=payload.expected_version,
        )
    except (record_service.StageNotFound, record_service.StageWorkflowMismatch) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except record_service.VersionConflict as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")

    return TransitionResponse(
        success=result.success,
        from_stage_id=result.from_stage_id,
        target_stage_id=result.target_stage_id,
        updated_stage_id=result.updated_stage_id,
        record_version=result.record_version,
        decision=_decision_to_schema(result.decision),
        message=result.message,
    )


@router.get("/{record_id}/documents", response_model=List[DocumentRead])
def list_documents(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    record = record_service.get_record(db, current_user, record_id)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")
    return document_service.list_for_record(db, current_user, record)


@router.post(
    "/{record_id}/documents",
    response_model=DocumentRead,
    status_code=status.HTTP_201_CREATED,
)
def upload_document(
    record_id: int,
    payload: DocumentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    record = record_service.get_record(db, current_user, record_id)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")
    return document_service.register_document_metadata(
        db,
        actor=current_user,
        record=record,
        document_type=payload.document_type,
        label=payload.label,
        storage_uri=payload.storage_uri,
        notes=payload.notes,
        original_filename=payload.original_filename,
        mime_type=payload.mime_type,
        size_bytes=payload.size_bytes,
        content_hash=payload.content_hash,
        expires_at=payload.expires_at,
    )


@router.post(
    "/{record_id}/documents/upload",
    response_model=DocumentRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[
        Depends(
            rate_limit(
                "documents.upload",
                max_requests=lambda: get_settings().rate_limit_upload_per_minute,
                window_seconds=60.0,
                authenticated=True,
            )
        )
    ],
)
async def upload_document_file(
    record_id: int,
    file: UploadFile = File(...),
    document_type: DocumentType = Form(...),
    label: Optional[str] = Form(default=None),
    notes: Optional[str] = Form(default=None),
    expires_at: Optional[datetime] = Form(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    record = record_service.get_record(db, current_user, record_id)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")

    try:
        return await document_service.upload_file_stream(
            db,
            actor=current_user,
            record=record,
            document_type=document_type,
            reader=file,
            original_filename=file.filename,
            mime_type=file.content_type,
            label=label,
            notes=notes,
            expires_at=expires_at,
        )
    except evidence_storage.EmptyPayload as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc
    except evidence_storage.UnsupportedContentType as exc:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=str(exc),
        ) from exc
    except evidence_storage.PayloadTooLarge as exc:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=str(exc),
        ) from exc


@router.get("/{record_id}/audit", response_model=List[AuditEntryRead])
def list_audit(
    record_id: int,
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    record = record_service.get_record(db, current_user, record_id)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")

    from sqlalchemy import select as sa_select

    from app.models.audit import AuditLog

    stmt = (
        sa_select(AuditLog)
        .where(AuditLog.record_id == record_id)
        .order_by(AuditLog.id.desc())
        .limit(limit)
    )
    return list(db.execute(stmt).scalars().all())


@router.get(
    "/{record_id}/integrity-summary",
    response_model=RecordIntegritySummaryResponse,
)
def record_integrity_summary(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    record = record_service.get_record(db, current_user, record_id)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")

    results = document_service.record_integrity_summary(
        db, actor=current_user, record=record
    )
    checked_at = datetime.now()
    return RecordIntegritySummaryResponse(
        record_id=record.id,
        checked_at=checked_at,
        documents=[
            IntegrityCheckResponse(
                document_id=r.document_id,
                has_stored_content=r.has_stored_content,
                expected_content_hash=r.expected_content_hash,
                actual_content_hash=r.actual_content_hash,
                is_match=r.is_match,
                checked_at=r.checked_at,
                message=r.message,
            )
            for r in results
        ],
    )


@router.get(
    "/{record_id}/evidence-summary",
    response_model=EvidenceSummaryResponse,
)
def evidence_summary(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    record = record_service.get_record(db, current_user, record_id)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")
    summary = document_service.evidence_summary(
        db, actor=current_user, record=record
    )
    return EvidenceSummaryResponse(**summary.__dict__)


@router.get("/{record_id}/document-status", response_model=DocumentStatusResponse)
def document_status(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    record = record_service.get_record(db, current_user, record_id)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")
    summary = document_service.document_status(db, record)
    return DocumentStatusResponse(
        required_types=summary.required_types,
        present_types=summary.present_types,
        verified_types=summary.verified_types,
        satisfied_types=summary.satisfied_types,
        missing_types=summary.missing_types,
        rejected_types=summary.rejected_types,
        documents=summary.documents,
    )
