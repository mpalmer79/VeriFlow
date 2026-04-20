"""Content delivery resolution for document evidence."""

from __future__ import annotations

from pathlib import Path
from typing import Tuple

from sqlalchemy.orm import Session

from app.core import evidence_storage
from app.models.document import Document
from app.models.user import User
from app.repositories import document_repository

from ._core import DocumentContentMissing, DocumentNotFound, require_document_access


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
    require_document_access(doc, record, actor)

    path = evidence_storage.resolve_local_path(doc.storage_uri)
    if path is None:
        raise DocumentContentMissing(
            f"Document {doc.id} has no resolvable stored content."
        )
    return doc, path
