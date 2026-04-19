import re
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core import evidence_storage
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


_CD_SAFE = re.compile(r"[^A-Za-z0-9._-]+")
_RANGE_RE = re.compile(r"^bytes=(\d*)-(\d*)$")

PREVIEWABLE_CONTENT_TYPES: frozenset[str] = frozenset(
    {"application/pdf", "image/png", "image/jpeg"}
)


def _content_disposition_filename(document) -> str:
    """Return a safe ASCII filename suitable for Content-Disposition."""
    raw = document.original_filename or f"document-{document.id}"
    cleaned = _CD_SAFE.sub("_", raw).strip("._") or f"document-{document.id}"
    return cleaned[:200]


def _parse_range_header(value: str, file_size: int) -> Optional[tuple[int, int]]:
    """Parse a single-range `Range: bytes=start-end` header.

    Returns `(start, end)` inclusive on success, `None` when the header is
    present but unusable (caller should respond 416). Multiple ranges are
    deliberately not supported in this phase; we treat any multi-range
    header as unusable.
    """
    if "," in value:
        return None
    match = _RANGE_RE.match(value.strip())
    if not match:
        return None
    raw_start, raw_end = match.group(1), match.group(2)
    if file_size <= 0:
        return None
    if raw_start == "" and raw_end == "":
        return None
    if raw_start == "":
        # Suffix range: last N bytes.
        suffix = int(raw_end)
        if suffix <= 0:
            return None
        start = max(0, file_size - suffix)
        end = file_size - 1
    else:
        start = int(raw_start)
        end = int(raw_end) if raw_end else file_size - 1
    if start < 0 or start >= file_size or end < start:
        return None
    if end >= file_size:
        end = file_size - 1
    return start, end


_BASE_CONTENT_HEADERS: dict[str, str] = {
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store, max-age=0",
    "Referrer-Policy": "no-referrer",
    "Accept-Ranges": "bytes",
}


@router.get("/{document_id}/content")
async def download_document_content(
    document_id: int,
    disposition: str = Query("attachment", pattern="^(attachment|inline)$"),
    range_header: Optional[str] = Header(default=None, alias="Range"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        doc, path = document_service.resolve_content_for_download(
            db, actor=current_user, document_id=document_id
        )
    except document_service.DocumentNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except document_service.DocumentAccessDenied as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except document_service.DocumentContentMissing as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc

    try:
        file_size = path.stat().st_size
    except OSError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stored content is missing or unreadable.",
        ) from exc

    filename = _content_disposition_filename(doc)
    media_type = doc.mime_type or "application/octet-stream"

    # Inline delivery is only offered for content types the frontend can
    # render safely; everything else is delivered as an attachment even if
    # the caller asked for inline.
    effective_disposition = (
        "inline"
        if disposition == "inline" and media_type in PREVIEWABLE_CONTENT_TYPES
        else "attachment"
    )

    headers = dict(_BASE_CONTENT_HEADERS)
    headers["Content-Disposition"] = (
        f'{effective_disposition}; filename="{filename}"'
    )

    parsed_range: Optional[tuple[int, int]] = None
    if range_header:
        parsed_range = _parse_range_header(range_header, file_size)
        if parsed_range is None:
            # Malformed or unsatisfiable range -> 416 with Content-Range: */size.
            raise HTTPException(
                status_code=status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE,
                detail="Invalid Range header",
                headers={"Content-Range": f"bytes */{file_size}"},
            )

    if parsed_range is not None:
        start, end = parsed_range
        headers["Content-Range"] = f"bytes {start}-{end}/{file_size}"
        headers["Content-Length"] = str(end - start + 1)
        return StreamingResponse(
            evidence_storage.iter_stored_chunks(
                doc.storage_uri, start=start, end=end
            ),
            media_type=media_type,
            headers=headers,
            status_code=status.HTTP_206_PARTIAL_CONTENT,
        )

    headers["Content-Length"] = str(file_size)
    return StreamingResponse(
        evidence_storage.iter_stored_chunks(doc.storage_uri),
        media_type=media_type,
        headers=headers,
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
