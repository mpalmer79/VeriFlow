from datetime import datetime
from typing import Optional

from sqlalchemy import JSON, DateTime, ForeignKey, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"
    # Composite index for the two hot paths:
    # - `_latest_hash_in_scope` walks audit rows descending by id per
    #   organization on every audit write
    # - `verify_chain` does an ordered per-organization scan
    # A standalone `organization_id` index exists too, but an explicit
    # (organization_id, id) pair lets the planner satisfy both the
    # filter and the order-by from one index.
    __table_args__ = (
        Index("ix_audit_logs_org_id", "organization_id", "id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    organization_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True, index=True
    )
    actor_user_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    record_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("records.id", ondelete="SET NULL"), nullable=True, index=True
    )

    action: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    entity_type: Mapped[str] = mapped_column(String(80), nullable=False)
    entity_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    payload: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    previous_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    entry_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    organization: Mapped[Optional["Organization"]] = relationship(  # noqa: F821
        foreign_keys=[organization_id]
    )
    actor_user: Mapped[Optional["User"]] = relationship(  # noqa: F821
        foreign_keys=[actor_user_id]
    )
    record: Mapped[Optional["Record"]] = relationship(  # noqa: F821
        foreign_keys=[record_id]
    )
