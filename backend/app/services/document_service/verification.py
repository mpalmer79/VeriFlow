"""Document verification and rejection flows."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.core import evidence_storage
from app.models.document import Document
from app.models.enums import DocumentStatus
from app.models.user import User
from app.repositories import document_repository
from app.services import audit_service
from app.services.audit_payloads import (
    document_integrity_failed,
    document_rejected,
    document_verified,
)

from ._core import (
    DocumentAccessDenied,
    DocumentContentMissing,
    DocumentIntegrityFailure,
    DocumentNotFound,
    require_document_access,
)


@dataclass(frozen=True)
class IntegrityCheckResult:
    document_id: int
    has_stored_content: bool
    expected_content_hash: Optional[str]
    actual_content_hash: Optional[str]
    is_match: bool
    checked_at: datetime
    message: str


def verify_document(
    db: Session,
    *,
    actor: User,
    document_id: int,
    notes: Optional[str] = None,
) -> Document:
    doc = document_repository.get(db, document_id)
    if doc is None:
        raise DocumentNotFound(f"Document {document_id} not found")
    record = doc.record
    require_document_access(doc, record, actor)

    if doc.content_hash is None:
        raise DocumentContentMissing(
            f"Document {doc.id} has no ingest-time content_hash; nothing to verify against."
        )
    stored_bytes = evidence_storage.read_stored_bytes(doc.storage_uri)
    if stored_bytes is None:
        raise DocumentContentMissing(
            f"Document {doc.id} has no resolvable stored content to verify."
        )

    recomputed = evidence_storage.hash_bytes(stored_bytes)
    if recomputed != doc.content_hash:
        doc.status = DocumentStatus.REJECTED
        doc.rejected_by_user_id = actor.id
        doc.rejected_at = datetime.now(timezone.utc)
        doc.rejection_reason = (
            f"Integrity mismatch at verification: expected {doc.content_hash}, "
            f"actual {recomputed}."
        )
        doc.verified_by_user_id = None
        doc.verified_at = None
        db.flush()
        audit_service.record_event(
            db,
            action="document.integrity_failed",
            entity_type="document",
            entity_id=doc.id,
            organization_id=record.organization_id,
            actor_user_id=actor.id,
            record_id=record.id,
            payload=document_integrity_failed(
                document=doc,
                expected_content_hash=doc.content_hash,
                actual_content_hash=recomputed,
            ),
        )
        db.commit()
        raise DocumentIntegrityFailure(
            document_id=doc.id,
            expected=doc.content_hash,
            actual=recomputed,
        )

    doc.status = DocumentStatus.VERIFIED
    doc.verified_by_user_id = actor.id
    doc.verified_at = datetime.now(timezone.utc)
    doc.rejected_by_user_id = None
    doc.rejected_at = None
    doc.rejection_reason = None
    if notes is not None:
        doc.notes = notes
    db.flush()

    audit_service.record_event(
        db,
        action="document.verified",
        entity_type="document",
        entity_id=doc.id,
        organization_id=record.organization_id,
        actor_user_id=actor.id,
        record_id=record.id,
        payload=document_verified(document=doc, verified_by=actor.id),
    )
    db.commit()
    db.refresh(doc)
    return doc


def reject_document(
    db: Session,
    *,
    actor: User,
    document_id: int,
    reason: Optional[str] = None,
) -> Document:
    doc = document_repository.get(db, document_id)
    if doc is None:
        raise DocumentNotFound(f"Document {document_id} not found")
    record = doc.record
    require_document_access(doc, record, actor)

    doc.status = DocumentStatus.REJECTED
    doc.rejected_by_user_id = actor.id
    doc.rejected_at = datetime.now(timezone.utc)
    doc.rejection_reason = reason
    doc.verified_by_user_id = None
    doc.verified_at = None
    db.flush()

    audit_service.record_event(
        db,
        action="document.rejected",
        entity_type="document",
        entity_id=doc.id,
        organization_id=record.organization_id,
        actor_user_id=actor.id,
        record_id=record.id,
        payload=document_rejected(
            document=doc, rejected_by=actor.id, rejection_reason=reason
        ),
    )
    db.commit()
    db.refresh(doc)
    return doc


def check_integrity(
    db: Session,
    *,
    actor: User,
    document_id: int,
) -> IntegrityCheckResult:
    doc = document_repository.get(db, document_id)
    if doc is None:
        raise DocumentNotFound(f"Document {document_id} not found")
    record = doc.record
    require_document_access(doc, record, actor)

    stored_bytes = evidence_storage.read_stored_bytes(doc.storage_uri)
    checked_at = datetime.now(timezone.utc)

    if doc.content_hash is None and stored_bytes is None:
        return IntegrityCheckResult(
            document_id=doc.id,
            has_stored_content=False,
            expected_content_hash=None,
            actual_content_hash=None,
            is_match=False,
            checked_at=checked_at,
            message="Document is metadata-only; nothing to verify.",
        )
    if stored_bytes is None:
        return IntegrityCheckResult(
            document_id=doc.id,
            has_stored_content=False,
            expected_content_hash=doc.content_hash,
            actual_content_hash=None,
            is_match=False,
            checked_at=checked_at,
            message="Stored content is missing or unreadable.",
        )
    actual = evidence_storage.hash_bytes(stored_bytes)
    is_match = doc.content_hash is not None and actual == doc.content_hash
    return IntegrityCheckResult(
        document_id=doc.id,
        has_stored_content=True,
        expected_content_hash=doc.content_hash,
        actual_content_hash=actual,
        is_match=is_match,
        checked_at=checked_at,
        message="Match" if is_match else "Integrity mismatch between stored bytes and ingest hash.",
    )
