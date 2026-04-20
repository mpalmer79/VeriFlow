"""Document service (package form).

Before Phase 7, this was a single `document_service.py` module. It now
lives as a package of focused submodules so each concern is easier to
read and evolve. The public surface is unchanged: every name previously
exposed by `document_service.py` is re-exported here, so existing
imports like `from app.services import document_service` and calls like
`document_service.upload_file_stream(...)` continue to work.
"""

from ._core import (
    DocumentAccessDenied,
    DocumentContentMissing,
    DocumentIntegrityFailure,
    DocumentNotFound,
    DocumentServiceError,
)
from .cleanup import delete_document
from .content import resolve_content_for_download
from .ingest import (
    register_document_metadata,
    upload_file_document,
    upload_file_stream,
)
from .summary import (
    DocumentStatusSummary,
    EvidenceSummary,
    document_status,
    evidence_summary,
    list_for_record,
    record_integrity_summary,
    required_document_types,
)
from .verification import (
    IntegrityCheckResult,
    check_integrity,
    reject_document,
    verify_document,
)

# Backward-compatible alias used by the JSON registration route.
upload_document = register_document_metadata


__all__ = [
    "DocumentServiceError",
    "DocumentNotFound",
    "DocumentAccessDenied",
    "DocumentContentMissing",
    "DocumentIntegrityFailure",
    "DocumentStatusSummary",
    "EvidenceSummary",
    "IntegrityCheckResult",
    "check_integrity",
    "delete_document",
    "document_status",
    "evidence_summary",
    "list_for_record",
    "record_integrity_summary",
    "register_document_metadata",
    "reject_document",
    "required_document_types",
    "resolve_content_for_download",
    "upload_document",
    "upload_file_document",
    "upload_file_stream",
    "verify_document",
]
