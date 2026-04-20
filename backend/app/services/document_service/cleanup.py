"""Document deletion and its storage cleanup."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.core import evidence_storage
from app.models.user import User
from app.repositories import document_repository
from app.services import audit_service
from app.services.audit_payloads import document_deleted

from ._core import DocumentNotFound, require_document_access


def delete_document(
    db: Session,
    *,
    actor: User,
    document_id: int,
) -> None:
    doc = document_repository.get(db, document_id)
    if doc is None:
        raise DocumentNotFound(f"Document {document_id} not found")
    record = doc.record
    require_document_access(doc, record, actor)

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
