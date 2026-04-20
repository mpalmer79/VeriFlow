"""Per-record summaries derived from a record's documents."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List

from sqlalchemy.orm import Session

from app.core import evidence_storage
from app.models.document import Document
from app.models.enums import DocumentStatus, DocumentType
from app.models.record import Record
from app.models.user import User
from app.repositories import document_repository

from ._core import DocumentAccessDenied, require_same_org
from .verification import IntegrityCheckResult, check_integrity


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
    and `missing_types ⊆ required_types` both hold.
    """

    required_types: List[str]
    present_types: List[str]
    verified_types: List[str]
    satisfied_types: List[str]
    missing_types: List[str]
    rejected_types: List[str]
    documents: List[Document]


@dataclass(frozen=True)
class EvidenceSummary:
    """Operational snapshot of a record's evidence state."""

    record_id: int
    documents_total: int
    upload_backed: int
    metadata_only: int
    verified: int
    rejected: int
    integrity_checkable: int
    missing_content: int
    stored_bytes: int


def list_for_record(db: Session, actor: User, record: Record) -> List[Document]:
    require_same_org(record, actor)
    return document_repository.list_for_record(db, record.id)


def required_document_types(db: Session, record: Record) -> List[DocumentType]:
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


def evidence_summary(
    db: Session,
    *,
    actor: User,
    record: Record,
) -> EvidenceSummary:
    require_same_org(record, actor)

    docs = document_repository.list_for_record(db, record.id)
    upload_backed = 0
    metadata_only = 0
    verified = 0
    rejected = 0
    integrity_checkable = 0
    missing_content = 0
    stored_bytes = 0

    for doc in docs:
        if doc.status == DocumentStatus.VERIFIED:
            verified += 1
        if doc.status == DocumentStatus.REJECTED:
            rejected += 1
        if doc.has_stored_content:
            upload_backed += 1
            resolved = evidence_storage.resolve_local_path(doc.storage_uri)
            if resolved is None:
                missing_content += 1
            else:
                if doc.content_hash is not None:
                    integrity_checkable += 1
                try:
                    stored_bytes += resolved.stat().st_size
                except OSError:
                    missing_content += 1
        else:
            metadata_only += 1

    return EvidenceSummary(
        record_id=record.id,
        documents_total=len(docs),
        upload_backed=upload_backed,
        metadata_only=metadata_only,
        verified=verified,
        rejected=rejected,
        integrity_checkable=integrity_checkable,
        missing_content=missing_content,
        stored_bytes=stored_bytes,
    )


def record_integrity_summary(
    db: Session,
    *,
    actor: User,
    record: Record,
) -> List[IntegrityCheckResult]:
    require_same_org(record, actor)
    documents = document_repository.list_for_record(db, record.id)
    return [
        check_integrity(db, actor=actor, document_id=doc.id) for doc in documents
    ]
