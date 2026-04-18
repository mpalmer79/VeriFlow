from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Enum, ForeignKey, String
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
