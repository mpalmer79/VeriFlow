import re
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core import evidence_storage
from app.core.config import get_settings
from app.core.database import get_db
from app.core.rate_limit import rate_limit
from app.core.security import (
    CONTENT_ACCESS_DEFAULT_TTL_SECONDS,
    TokenValidationError,
    create_content_access_token,
    decode_content_access_token,
)
from app.models.document import Document
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


class SignedAccessRequest(BaseModel):
    disposition: str = Field(default="inline", pattern="^(attachment|inline)$")
    ttl_seconds: Optional[int] = Field(default=None, ge=10, le=600)


class SignedAccessResponse(BaseModel):
    token: str
    expires_at: datetime
    ttl_seconds: int
    document_id: int
    disposition: str
    url: str


def _serve_document_content(
    doc,
    path,
    *,
    disposition: str,
    range_header: Optional[str],
):
    try:
        file_size = path.stat().st_size
    except OSError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stored content is missing or unreadable.",
        ) from exc

    filename = _content_disposition_filename(doc)
    media_type = doc.mime_type or "application/octet-stream"

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

    return _serve_document_content(
        doc, path, disposition=disposition, range_header=range_header
    )


@router.post(
    "/{document_id}/signed-access",
    response_model=SignedAccessResponse,
    dependencies=[
        Depends(
            rate_limit(
                "documents.signed_access",
                max_requests=lambda: get_settings().rate_limit_signed_access_per_minute,
                window_seconds=60.0,
                authenticated=True,
            )
        )
    ],
)
def issue_signed_content_access(
    document_id: int,
    payload: SignedAccessRequest | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mint a short-lived signed token a browser can use in a plain URL
    (without an Authorization header) to fetch one document's content
    once. Only upload-backed documents are eligible.
    """
    try:
        doc, _path = document_service.resolve_content_for_download(
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

    disposition = payload.disposition if payload else "inline"
    ttl_seconds = (
        payload.ttl_seconds
        if payload and payload.ttl_seconds is not None
        else get_settings().content_access_ttl_seconds
    )
    token, expires_at = create_content_access_token(
        document_id=doc.id,
        organization_id=doc.record.organization_id,
        user_id=current_user.id,
        disposition=disposition,
        ttl_seconds=ttl_seconds,
    )
    # The url is a path relative to the API prefix; the frontend composes
    # the full URL using its own API base so we don't bake an absolute
    # host into the response.
    url = f"/documents/content/signed?token={token}"
    return SignedAccessResponse(
        token=token,
        expires_at=expires_at,
        ttl_seconds=ttl_seconds,
        document_id=doc.id,
        disposition=disposition,
        url=url,
    )


@router.get("/content/signed")
async def download_signed_content(
    token: str = Query(...),
    range_header: Optional[str] = Header(default=None, alias="Range"),
    db: Session = Depends(get_db),
):
    """Serve one document's content for a caller that presents a valid
    short-lived content-access token. No Authorization header required —
    the token itself is the authorization. Scope is verified against the
    token claims (document id + organization id).
    """
    try:
        claims = decode_content_access_token(token)
    except TokenValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)
        ) from exc

    document_id = int(claims["doc"])
    organization_id = int(claims["org"])
    disposition = str(claims.get("disp", "inline"))

    doc = db.get(Document, document_id)
    if doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Document not found"
        )
    if doc.record is None or doc.record.organization_id != organization_id:
        # Org association changed since the token was minted; refuse.
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Token is no longer valid for this document",
        )

    path = evidence_storage.resolve_local_path(doc.storage_uri)
    if path is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stored content is missing or unreadable.",
        )
    return _serve_document_content(
        doc, path, disposition=disposition, range_header=range_header
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
