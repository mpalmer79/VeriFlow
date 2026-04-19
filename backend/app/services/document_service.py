"""Document evidence service.

Owns the lifecycle of document evidence attached to a record: upload,
verification, rejection, and the computed per-record document status.
Rules consume this evidence via `document_repository` helpers; the
service itself emits structured audit events for every state change.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from app.models.document import Document
from app.models.enums import DocumentStatus, DocumentType
from app.models.record import Record
from app.models.user import User
from app.repositories import document_repository
from app.services import audit_service
from app.services.audit_payloads import (
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


def upload_document(
    db: Session,
    *,
    actor: User,
    record: Record,
    document_type: DocumentType,
    label: Optional[str] = None,
    storage_uri: Optional[str] = None,
    notes: Optional[str] = None,
) -> Document:
    if record.organization_id != actor.organization_id:
        raise DocumentAccessDenied("Record does not belong to this organization")

    doc = Document(
        record_id=record.id,
        document_type=document_type,
        label=label,
        storage_uri=storage_uri,
        notes=notes,
        status=DocumentStatus.UPLOADED,
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


def _require_access(doc: Document, record: Record, actor: User) -> None:
    if doc.record_id != record.id or record.organization_id != actor.organization_id:
        raise DocumentAccessDenied("Document does not belong to this organization")


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
    _require_access(doc, record, actor)

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
