"""Document ingest: JSON metadata registration and multipart upload."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from app.core import evidence_storage
from app.models.document import Document
from app.models.enums import DocumentStatus, DocumentType
from app.models.record import Record
from app.models.user import User
from app.services import audit_service
from app.services.audit_payloads import document_uploaded

from ._core import DocumentAccessDenied, require_same_org


def _persist_uploaded_document(
    db: Session,
    *,
    actor: User,
    record: Record,
    document_type: DocumentType,
    stored: "evidence_storage.StoredObject",
    resolved_mime: str,
    original_filename: Optional[str],
    label: Optional[str],
    notes: Optional[str],
    expires_at: Optional[datetime],
) -> Document:
    doc = Document(
        record_id=record.id,
        document_type=document_type,
        label=label,
        storage_uri=stored.storage_uri,
        notes=notes,
        status=DocumentStatus.UPLOADED,
        original_filename=evidence_storage.safe_filename(original_filename),
        mime_type=resolved_mime,
        size_bytes=stored.size_bytes,
        content_hash=stored.content_hash,
        expires_at=expires_at,
    )
    db.add(doc)
    db.flush()

    audit_service.record_event(
        db,
        action="document.uploaded",
        entity_type="document",
        entity_id=doc.id,
        organization_id=record.organization_id,
        actor_user_id=actor.id,
        record_id=record.id,
        payload=document_uploaded(document=doc),
    )
    db.commit()
    db.refresh(doc)
    return doc


def register_document_metadata(
    db: Session,
    *,
    actor: User,
    record: Record,
    document_type: DocumentType,
    label: Optional[str] = None,
    storage_uri: Optional[str] = None,
    notes: Optional[str] = None,
    original_filename: Optional[str] = None,
    mime_type: Optional[str] = None,
    size_bytes: Optional[int] = None,
    content_hash: Optional[str] = None,
    expires_at: Optional[datetime] = None,
) -> Document:
    """Legacy metadata-only path. Rows created this way cannot be
    verified against stored content.
    """
    require_same_org(record, actor)

    safe_uri = None if evidence_storage.is_local_uri(storage_uri) else storage_uri

    doc = Document(
        record_id=record.id,
        document_type=document_type,
        label=label,
        storage_uri=safe_uri,
        notes=notes,
        status=DocumentStatus.UPLOADED,
        original_filename=evidence_storage.safe_filename(original_filename),
        mime_type=mime_type,
        size_bytes=size_bytes,
        content_hash=content_hash,
        expires_at=expires_at,
    )
    db.add(doc)
    db.flush()

    audit_service.record_event(
        db,
        action="document.registered",
        entity_type="document",
        entity_id=doc.id,
        organization_id=record.organization_id,
        actor_user_id=actor.id,
        record_id=record.id,
        payload=document_uploaded(document=doc),
    )
    db.commit()
    db.refresh(doc)
    return doc


def upload_file_document(
    db: Session,
    *,
    actor: User,
    record: Record,
    document_type: DocumentType,
    content: bytes,
    original_filename: Optional[str] = None,
    mime_type: Optional[str] = None,
    label: Optional[str] = None,
    notes: Optional[str] = None,
    expires_at: Optional[datetime] = None,
) -> Document:
    """Ingest bytes already held in memory. Prefer `upload_file_stream`
    from the route layer; this function exists for service-layer
    callers and tests that already have a bytes object.
    """
    require_same_org(record, actor)

    if not content:
        raise evidence_storage.EmptyPayload("File payload is empty")

    resolved_mime = evidence_storage.detect_content_type(content, mime_type)
    stored = evidence_storage.store_bytes(content)

    return _persist_uploaded_document(
        db,
        actor=actor,
        record=record,
        document_type=document_type,
        stored=stored,
        resolved_mime=resolved_mime,
        original_filename=original_filename,
        label=label,
        notes=notes,
        expires_at=expires_at,
    )


async def upload_file_stream(
    db: Session,
    *,
    actor: User,
    record: Record,
    document_type: DocumentType,
    reader,
    original_filename: Optional[str] = None,
    mime_type: Optional[str] = None,
    label: Optional[str] = None,
    notes: Optional[str] = None,
    expires_at: Optional[datetime] = None,
) -> Document:
    """Streaming ingest: validate type on the peeked head bytes, hash and
    persist the rest chunk-by-chunk, and clean up partial files on any
    failure.
    """
    require_same_org(record, actor)

    stored, resolved_mime = await evidence_storage.store_stream(
        reader, client_mime=mime_type
    )

    try:
        return _persist_uploaded_document(
            db,
            actor=actor,
            record=record,
            document_type=document_type,
            stored=stored,
            resolved_mime=resolved_mime,
            original_filename=original_filename,
            label=label,
            notes=notes,
            expires_at=expires_at,
        )
    except BaseException:
        evidence_storage.delete_local_object(stored.storage_uri)
        raise
