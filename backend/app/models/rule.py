from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.enums import RuleActionApplied, RuleActionType, RuleSeverity


class Rule(Base, TimestampMixin):
    __tablename__ = "rules"
    __table_args__ = (
        UniqueConstraint("workflow_id", "code", name="uq_rule_workflow_code"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    workflow_id: Mapped[int] = mapped_column(
        ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False, index=True
    )
    stage_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("workflow_stages.id", ondelete="CASCADE"), nullable=True, index=True
    )

    code: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)

    action: Mapped[RuleActionType] = mapped_column(
        Enum(RuleActionType, name="rule_action_type", native_enum=True, validate_strings=True),
        nullable=False,
    )
    severity: Mapped[RuleSeverity] = mapped_column(
        Enum(RuleSeverity, name="rule_severity", native_enum=True, validate_strings=True),
        nullable=False,
    )
    risk_weight: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    workflow: Mapped["Workflow"] = relationship(back_populates="rules")  # noqa: F821
    stage: Mapped[Optional["WorkflowStage"]] = relationship(back_populates="rules")  # noqa: F821


class RuleEvaluation(Base):
    __tablename__ = "rule_evaluations"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    record_id: Mapped[int] = mapped_column(
        ForeignKey("records.id", ondelete="CASCADE"), nullable=False, index=True
    )
    rule_id: Mapped[int] = mapped_column(
        ForeignKey("rules.id", ondelete="CASCADE"), nullable=False, index=True
    )

    passed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    action_applied: Mapped[RuleActionApplied] = mapped_column(
        Enum(
            RuleActionApplied,
            name="rule_action_applied",
            native_enum=True,
            validate_strings=True,
        ),
        nullable=False,
        default=RuleActionApplied.NONE,
    )
    risk_applied: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    explanation: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    evaluated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    record: Mapped["Record"] = relationship(back_populates="rule_evaluations")  # noqa: F821
    rule: Mapped["Rule"] = relationship()
