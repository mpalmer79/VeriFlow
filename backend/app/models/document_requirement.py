from typing import Optional

from sqlalchemy import Boolean, Enum, ForeignKey, Index, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.enums import DocumentType


class DocumentRequirement(Base, TimestampMixin):
    """A document type that a workflow (optionally scoped to a stage) requires.

    `applies_when_code` is reserved for future conditional-requirement logic
    (e.g. "guardian_authorization only applies when the subject is a minor").
    It is not interpreted in this phase; `guardian_authorization_required`
    keeps its minor check in code. Keeping the column now keeps the schema
    forward-compatible without pushing a DSL into scope.

    Uniqueness is enforced via two partial unique indexes so nullable
    `stage_id` does not allow duplicates:

    - `uq_doc_req_workflow_global_type` — when `stage_id IS NULL`, only
      one row per `(workflow_id, document_type)` may exist.
    - `uq_doc_req_workflow_stage_type` — when `stage_id IS NOT NULL`,
      only one row per `(workflow_id, stage_id, document_type)` may
      exist.

    A standard multi-column unique constraint would not catch duplicate
    workflow-global rows in PostgreSQL because NULLs are treated as
    distinct.
    """

    __tablename__ = "document_requirements"
    __table_args__ = (
        Index(
            "uq_doc_req_workflow_global_type",
            "workflow_id",
            "document_type",
            unique=True,
            postgresql_where=text("stage_id IS NULL"),
            sqlite_where=text("stage_id IS NULL"),
        ),
        Index(
            "uq_doc_req_workflow_stage_type",
            "workflow_id",
            "stage_id",
            "document_type",
            unique=True,
            postgresql_where=text("stage_id IS NOT NULL"),
            sqlite_where=text("stage_id IS NOT NULL"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    workflow_id: Mapped[int] = mapped_column(
        ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False, index=True
    )
    stage_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("workflow_stages.id", ondelete="CASCADE"), nullable=True, index=True
    )
    document_type: Mapped[DocumentType] = mapped_column(
        Enum(DocumentType, name="document_type", native_enum=True, validate_strings=True),
        nullable=False,
    )
    is_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    applies_when_code: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    workflow: Mapped["Workflow"] = relationship()  # noqa: F821
    stage: Mapped[Optional["WorkflowStage"]] = relationship()  # noqa: F821
