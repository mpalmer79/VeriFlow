from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import DocumentStatus, DocumentType


class DocumentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    record_id: int
    document_type: DocumentType
    label: Optional[str]
    storage_uri: Optional[str]
    original_filename: Optional[str]
    mime_type: Optional[str]
    size_bytes: Optional[int]
    content_hash: Optional[str]
    verified_content_hash: Optional[str]
    expires_at: Optional[datetime]
    status: DocumentStatus
    notes: Optional[str]
    verified_by_user_id: Optional[int]
    verified_at: Optional[datetime]
    rejected_by_user_id: Optional[int]
    rejected_at: Optional[datetime]
    rejection_reason: Optional[str]
    created_at: datetime
    updated_at: datetime


class DocumentCreate(BaseModel):
    document_type: DocumentType
    label: Optional[str] = Field(default=None, max_length=200)
    storage_uri: Optional[str] = Field(default=None, max_length=500)
    notes: Optional[str] = Field(default=None, max_length=1000)
    original_filename: Optional[str] = Field(default=None, max_length=255)
    mime_type: Optional[str] = Field(default=None, max_length=120)
    size_bytes: Optional[int] = Field(default=None, ge=0)
    content_hash: Optional[str] = Field(default=None, max_length=128)
    expires_at: Optional[datetime] = None


class DocumentVerifyRequest(BaseModel):
    # `verified_content_hash` is not accepted here. The verified hash is
    # recomputed server-side from the stored bytes; a client cannot attest
    # to content it has not supplied.
    notes: Optional[str] = Field(default=None, max_length=1000)


class DocumentRejectRequest(BaseModel):
    reason: Optional[str] = Field(default=None, max_length=1000)


class IntegrityCheckResponse(BaseModel):
    document_id: int
    has_stored_content: bool
    expected_content_hash: Optional[str]
    actual_content_hash: Optional[str]
    is_match: bool
    checked_at: datetime
    message: str


class DocumentStatusResponse(BaseModel):
    """See `document_service.DocumentStatusSummary` for field semantics.

    `required_types = satisfied_types + missing_types` always holds.
    `rejected_types` is historical and can overlap with either.
    """

    required_types: List[DocumentType]
    present_types: List[DocumentType]
    verified_types: List[DocumentType]
    satisfied_types: List[DocumentType]
    missing_types: List[DocumentType]
    rejected_types: List[DocumentType]
    documents: List[DocumentRead]
