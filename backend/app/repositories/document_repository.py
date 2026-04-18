from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.document import Document
from app.models.document_requirement import DocumentRequirement
from app.models.enums import DocumentType


def list_for_record(db: Session, record_id: int) -> List[Document]:
    stmt = (
        select(Document)
        .where(Document.record_id == record_id)
        .order_by(Document.id.asc())
    )
    return list(db.execute(stmt).scalars().all())


def get(db: Session, document_id: int) -> Optional[Document]:
    return db.get(Document, document_id)


def requirements_for_workflow(
    db: Session, workflow_id: int
) -> List[DocumentRequirement]:
    stmt = (
        select(DocumentRequirement)
        .where(DocumentRequirement.workflow_id == workflow_id)
        .order_by(DocumentRequirement.id.asc())
    )
    return list(db.execute(stmt).scalars().all())


def has_verified(record: object, document_type: DocumentType) -> bool:
    """Return True if the record has at least one VERIFIED document of the given type."""
    from app.models.enums import DocumentStatus

    return any(
        doc.document_type == document_type and doc.status == DocumentStatus.VERIFIED
        for doc in getattr(record, "documents", []) or []
    )


def has_present(record: object, document_type: DocumentType) -> bool:
    """Return True if the record has any non-rejected document of the given type."""
    from app.models.enums import DocumentStatus

    return any(
        doc.document_type == document_type and doc.status != DocumentStatus.REJECTED
        for doc in getattr(record, "documents", []) or []
    )
