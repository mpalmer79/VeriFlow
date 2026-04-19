from datetime import date
from typing import List, Optional

from sqlalchemy import Boolean, Date, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.enums import (
    ConsentStatus,
    InsuranceStatus,
    MedicalHistoryStatus,
    RecordStatus,
    RiskBand,
)


class Record(Base, TimestampMixin):
    __tablename__ = "records"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    workflow_id: Mapped[int] = mapped_column(
        ForeignKey("workflows.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    current_stage_id: Mapped[int] = mapped_column(
        ForeignKey("workflow_stages.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    assigned_user_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )

    external_reference: Mapped[Optional[str]] = mapped_column(String(80), nullable=True, index=True)
    subject_full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    subject_dob: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    status: Mapped[RecordStatus] = mapped_column(
        Enum(RecordStatus, name="record_status", native_enum=True, validate_strings=True),
        nullable=False,
        default=RecordStatus.DRAFT,
    )
    insurance_status: Mapped[InsuranceStatus] = mapped_column(
        Enum(InsuranceStatus, name="insurance_status", native_enum=True, validate_strings=True),
        nullable=False,
        default=InsuranceStatus.UNKNOWN,
    )
    consent_status: Mapped[ConsentStatus] = mapped_column(
        Enum(ConsentStatus, name="consent_status", native_enum=True, validate_strings=True),
        nullable=False,
        default=ConsentStatus.NOT_PROVIDED,
    )
    medical_history_status: Mapped[MedicalHistoryStatus] = mapped_column(
        Enum(
            MedicalHistoryStatus,
            name="medical_history_status",
            native_enum=True,
            validate_strings=True,
        ),
        nullable=False,
        default=MedicalHistoryStatus.NOT_STARTED,
    )

    identity_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    guardian_authorization_signed: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    allergy_info_provided: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    insurance_in_network: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)

    risk_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    risk_band: Mapped[RiskBand] = mapped_column(
        Enum(RiskBand, name="risk_band", native_enum=True, validate_strings=True),
        nullable=False,
        default=RiskBand.LOW,
    )

    notes: Mapped[Optional[str]] = mapped_column(String(2000), nullable=True)

    organization: Mapped["Organization"] = relationship(back_populates="records")  # noqa: F821
    workflow: Mapped["Workflow"] = relationship(back_populates="records")  # noqa: F821
    current_stage: Mapped["WorkflowStage"] = relationship()  # noqa: F821
    assigned_user: Mapped[Optional["User"]] = relationship()  # noqa: F821
    documents: Mapped[List["Document"]] = relationship(  # noqa: F821
        back_populates="record", cascade="all, delete-orphan"
    )
    rule_evaluations: Mapped[List["RuleEvaluation"]] = relationship(  # noqa: F821
        back_populates="record", cascade="all, delete-orphan"
    )

    @property
    def assigned_user_name(self) -> Optional[str]:
        return self.assigned_user.full_name if self.assigned_user else None

