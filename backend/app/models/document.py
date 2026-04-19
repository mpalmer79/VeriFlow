from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, DateTime, Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.enums import DocumentStatus, DocumentType


class Document(Base, TimestampMixin):
    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    record_id: Mapped[int] = mapped_column(
        ForeignKey("records.id", ondelete="CASCADE"), nullable=False, index=True
    )
    document_type: Mapped[DocumentType] = mapped_column(
        Enum(DocumentType, name="document_type", native_enum=True, validate_strings=True),
        nullable=False,
        index=True,
    )
    label: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    storage_uri: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    original_filename: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    mime_type: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    size_bytes: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    content_hash: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, index=True)
    verified_content_hash: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    expires_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    status: Mapped[DocumentStatus] = mapped_column(
        Enum(DocumentStatus, name="document_status", native_enum=True, validate_strings=True),
        nullable=False,
        default=DocumentStatus.UPLOADED,
    )
    notes: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)

    verified_by_user_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    verified_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    rejected_by_user_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    rejected_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    rejection_reason: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)

    record: Mapped["Record"] = relationship(back_populates="documents")  # noqa: F821
    verified_by: Mapped[Optional["User"]] = relationship(  # noqa: F821
        foreign_keys=[verified_by_user_id]
    )
    rejected_by: Mapped[Optional["User"]] = relationship(  # noqa: F821
        foreign_keys=[rejected_by_user_id]
    )

    @property
    def has_stored_content(self) -> bool:
        # Derived from storage_uri: a row that carries a server-managed
        # `file:` URI is backed by real bytes on disk. Metadata-only
        # registrations never set a local URI so this stays False.
        from app.core.evidence_storage import is_local_uri

        return is_local_uri(self.storage_uri)
