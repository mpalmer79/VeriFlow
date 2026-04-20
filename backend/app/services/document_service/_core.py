"""Shared exception types and internal access helpers for the document
service package. Kept private; callers import public names through the
package's `__init__`.
"""

from __future__ import annotations

from app.models.document import Document
from app.models.record import Record
from app.models.user import User


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


def require_same_org(record: Record, actor: User) -> None:
    if record.organization_id != actor.organization_id:
        raise DocumentAccessDenied("Record does not belong to this organization")


def require_document_access(doc: Document, record: Record, actor: User) -> None:
    if doc.record_id != record.id or record.organization_id != actor.organization_id:
        raise DocumentAccessDenied("Document does not belong to this organization")
