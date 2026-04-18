from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import (
    ConsentStatus,
    InsuranceStatus,
    MedicalHistoryStatus,
    RecordStatus,
    RiskBand,
)


class RecordBase(BaseModel):
    subject_full_name: str = Field(min_length=1, max_length=200)
    subject_dob: Optional[date] = None
    external_reference: Optional[str] = Field(default=None, max_length=80)
    notes: Optional[str] = Field(default=None, max_length=2000)


class RecordCreate(RecordBase):
    workflow_id: int
    assigned_user_id: Optional[int] = None
    insurance_status: InsuranceStatus = InsuranceStatus.UNKNOWN
    consent_status: ConsentStatus = ConsentStatus.NOT_PROVIDED
    medical_history_status: MedicalHistoryStatus = MedicalHistoryStatus.NOT_STARTED


class RecordUpdate(BaseModel):
    subject_full_name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    subject_dob: Optional[date] = None
    external_reference: Optional[str] = Field(default=None, max_length=80)
    notes: Optional[str] = Field(default=None, max_length=2000)
    assigned_user_id: Optional[int] = None
    current_stage_id: Optional[int] = None
    status: Optional[RecordStatus] = None
    insurance_status: Optional[InsuranceStatus] = None
    consent_status: Optional[ConsentStatus] = None
    medical_history_status: Optional[MedicalHistoryStatus] = None


class RecordRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    organization_id: int
    workflow_id: int
    current_stage_id: int
    assigned_user_id: Optional[int]
    external_reference: Optional[str]
    subject_full_name: str
    subject_dob: Optional[date]
    status: RecordStatus
    insurance_status: InsuranceStatus
    consent_status: ConsentStatus
    medical_history_status: MedicalHistoryStatus
    risk_score: int
    risk_band: RiskBand
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime
