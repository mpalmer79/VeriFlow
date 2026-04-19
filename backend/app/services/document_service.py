"""Document evidence service.

Owns the lifecycle of document evidence attached to a record: upload,
verification, rejection, and the computed per-record document status.
Rules consume this evidence via `document_repository` helpers; the
service itself emits structured audit events for every state change.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.core import evidence_storage
from app.models.document import Document
from app.models.enums import DocumentStatus, DocumentType
from app.models.record import Record
from app.models.user import User
from app.repositories import document_repository
from app.services import audit_service
from app.services.audit_payloads import (
    document_deleted,
    document_integrity_failed,
    document_rejected,
    document_uploaded,
    document_verified,
)


class DocumentServiceError(Exception):
    pass


class DocumentNotFound(DocumentServiceError):
    pass


class DocumentAccessDenied(DocumentServiceError):
    pass


class DocumentContentMissing(DocumentServiceError):
    """Raised when a document has no resolvable stored content."""


class DocumentIntegrityFailure(DocumentServiceError):
    """Raised when a recomputed hash does not match the persisted `content_hash`."""

    def __init__(self, document_id: int, expected: str, actual: str) -> None:
        super().__init__(
            f"Document {document_id} integrity mismatch: expected {expected}, actual {actual}"
        )
        self.document_id = document_id
        self.expected = expected
        self.actual = actual


@dataclass(frozen=True)
class IntegrityCheckResult:
    document_id: int
    has_stored_content: bool
    expected_content_hash: Optional[str]
    actual_content_hash: Optional[str]
    is_match: bool
    checked_at: datetime
    message: str


@dataclass(frozen=True)
class DocumentStatusSummary:
    """Explicit, non-overlapping view of a record's document evidence.

    - `required_types`: document types required at the record's current
      stage (driven by `DocumentRequirement`).
    - `present_types`: types that have at least one non-rejected document
      attached. Present does not imply verified.
    - `verified_types`: types that have at least one verified document.
    - `rejected_types`: types that have at least one rejected document.
      This is historical information; a type can appear here alongside
      `verified_types` if a record has both a rejected and a later
      verified document.
    - `satisfied_types`: `required_types` intersected with
      `verified_types`. A requirement is **only** satisfied by a
      verified document; uploaded-but-not-yet-verified does not count.
    - `missing_types`: `required_types` minus `satisfied_types`. A
      requirement whose only evidence is uploaded-but-not-verified, or
      rejected, is `missing` until a verified document is attached.

    The invariants `required_types = satisfied_types + missing_types`
    and `missing_types ⊆ required_types` both hold, so API callers can
    rely on these sets as a partition of the requirement surface.
    """

    required_types: List[str]
    present_types: List[str]
    verified_types: List[str]
    satisfied_types: List[str]
    missing_types: List[str]
    rejected_types: List[str]
    documents: List[Document]


def list_for_record(db: Session, actor: User, record: Record) -> List[Document]:
    if record.organization_id != actor.organization_id:
        raise DocumentAccessDenied("Document does not belong to this organization")
    return document_repository.list_for_record(db, record.id)


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
    """Register a document without persisting actual bytes.

    Legacy/metadata-only path. Rows created this way cannot be verified
    against stored content; verification for them will fail with
    `DocumentContentMissing` until a corresponding upload lands.
    """
    if record.organization_id != actor.organization_id:
        raise DocumentAccessDenied("Record does not belong to this organization")

    # A metadata-only path must never claim a server-owned storage URI.
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


# Backward-compatible alias used by the existing JSON registration route.
upload_document = register_document_metadata


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
    """Ingest bytes already held in memory. Kept for service-layer
    callers and tests that already hold a bytes object; the route layer
    prefers `upload_file_stream` which avoids buffering.
    """
    if record.organization_id != actor.organization_id:
        raise DocumentAccessDenied("Record does not belong to this organization")

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
    """Ingest an upload stream chunk-by-chunk, validating type on the
    first bytes and aborting cleanly on oversize or unsupported content.
    """
    if record.organization_id != actor.organization_id:
        raise DocumentAccessDenied("Record does not belong to this organization")

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
        # A DB failure after the file has been committed would otherwise
        # leave an orphaned blob.
        evidence_storage.delete_local_object(stored.storage_uri)
        raise


def _require_access(doc: Document, record: Record, actor: User) -> None:
    if doc.record_id != record.id or record.organization_id != actor.organization_id:
        raise DocumentAccessDenied("Document does not belong to this organization")


def verify_document(
    db: Session,
    *,
    actor: User,
    document_id: int,
    notes: Optional[str] = None,
    # `verified_content_hash` is intentionally not accepted here. The
    # verified hash is derived from a re-read of stored bytes so a client
    # cannot attest to content it has not supplied.
) -> Document:
    doc = document_repository.get(db, document_id)
    if doc is None:
        raise DocumentNotFound(f"Document {document_id} not found")
    record = doc.record
    _require_access(doc, record, actor)

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
        # Treat integrity failure as a domain-specific rejection so the
        # document row does not linger in a misleading VERIFIED state.
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
    doc.verified_content_hash = recomputed
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


def check_integrity(
    db: Session,
    *,
    actor: User,
    document_id: int,
) -> IntegrityCheckResult:
    """Read-only integrity check. Never mutates the document row."""
    doc = document_repository.get(db, document_id)
    if doc is None:
        raise DocumentNotFound(f"Document {document_id} not found")
    record = doc.record
    _require_access(doc, record, actor)

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
    _require_access(doc, record, actor)

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


def delete_document(
    db: Session,
    *,
    actor: User,
    document_id: int,
) -> None:
    """Remove a document row and its stored content, if any.

    File cleanup goes through `evidence_storage.delete_local_object`
    which validates that the path lives inside the configured storage
    root; a URI that points outside or a missing file is tolerated.
    """
    doc = document_repository.get(db, document_id)
    if doc is None:
        raise DocumentNotFound(f"Document {document_id} not found")
    record = doc.record
    _require_access(doc, record, actor)

    stored_removed = evidence_storage.delete_local_object(doc.storage_uri)

    audit_service.record_event(
        db,
        action="document.deleted",
        entity_type="document",
        entity_id=doc.id,
        organization_id=record.organization_id,
        actor_user_id=actor.id,
        record_id=record.id,
        payload=document_deleted(
            document=doc,
            deleted_by=actor.id,
            stored_content_removed=stored_removed,
        ),
    )

    db.delete(doc)
    db.commit()


def resolve_content_for_download(
    db: Session,
    *,
    actor: User,
    document_id: int,
) -> Tuple[Document, Path]:
    """Return the document row plus the absolute path of its stored bytes.

    Enforces that the caller belongs to the record's organization and
    that the document is upload-backed; metadata-only registrations
    raise `DocumentContentMissing`. The path is always inside the
    configured evidence root.
    """
    doc = document_repository.get(db, document_id)
    if doc is None:
        raise DocumentNotFound(f"Document {document_id} not found")
    record = doc.record
    _require_access(doc, record, actor)

    path = evidence_storage.resolve_local_path(doc.storage_uri)
    if path is None:
        raise DocumentContentMissing(
            f"Document {doc.id} has no resolvable stored content."
        )
    return doc, path


def record_integrity_summary(
    db: Session,
    *,
    actor: User,
    record: Record,
) -> List[IntegrityCheckResult]:
    """Run the read-only integrity check against every document on a
    record and return the collected results in insertion order.
    """
    if record.organization_id != actor.organization_id:
        raise DocumentAccessDenied("Record does not belong to this organization")

    documents = document_repository.list_for_record(db, record.id)
    return [
        check_integrity(db, actor=actor, document_id=doc.id) for doc in documents
    ]


def required_document_types(db: Session, record: Record) -> List[DocumentType]:
    """Document types required for this record given its current stage.

    A requirement applies when it is marked required and either has no stage
    scope or is scoped to a stage at or before the record's current stage.
    """
    requirements = document_repository.requirements_for_workflow(db, record.workflow_id)
    stages_by_id = {stage.id: stage for stage in record.workflow.stages}
    current_order = record.current_stage.order_index if record.current_stage else None

    applicable: List[DocumentType] = []
    for req in requirements:
        if not req.is_required:
            continue
        if req.stage_id is not None:
            stage = stages_by_id.get(req.stage_id)
            if stage is None or current_order is None or stage.order_index > current_order:
                continue
        if req.document_type not in applicable:
            applicable.append(req.document_type)
    return applicable


def document_status(db: Session, record: Record) -> DocumentStatusSummary:
    documents = document_repository.list_for_record(db, record.id)
    required_types = required_document_types(db, record)

    by_type: Dict[DocumentType, List[Document]] = {}
    for doc in documents:
        by_type.setdefault(doc.document_type, []).append(doc)

    present_types: List[DocumentType] = []
    verified_types: List[DocumentType] = []
    rejected_types: List[DocumentType] = []
    for document_type, docs in by_type.items():
        if any(d.status != DocumentStatus.REJECTED for d in docs):
            present_types.append(document_type)
        if any(d.status == DocumentStatus.VERIFIED for d in docs):
            verified_types.append(document_type)
        if any(d.status == DocumentStatus.REJECTED for d in docs):
            rejected_types.append(document_type)

    verified_set = set(verified_types)
    satisfied_types = [t for t in required_types if t in verified_set]
    missing_types = [t for t in required_types if t not in verified_set]

    def _values(items: List[DocumentType]) -> List[str]:
        return [item.value for item in items]

    return DocumentStatusSummary(
        required_types=_values(required_types),
        present_types=_values(present_types),
        verified_types=_values(verified_types),
        satisfied_types=_values(satisfied_types),
        missing_types=_values(missing_types),
        rejected_types=_values(rejected_types),
        documents=documents,
    )
