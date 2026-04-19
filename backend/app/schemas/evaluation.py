from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import RiskBand, RuleActionApplied


class EvaluationIssue(BaseModel):
    rule_code: str
    message: str
    risk_applied: int


class EvaluationDecisionRead(BaseModel):
    can_progress: bool
    risk_score: int
    risk_band: RiskBand
    violations: List[EvaluationIssue]
    warnings: List[EvaluationIssue]
    summary: str


class RuleEvaluationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    rule_id: int
    rule_code: str
    rule_name: str
    passed: bool
    action_applied: RuleActionApplied
    risk_applied: int
    explanation: Optional[str]
    evaluated_at: datetime


class TransitionRequest(BaseModel):
    target_stage_id: int
    expected_version: int = Field(ge=1)


class TransitionResponse(BaseModel):
    success: bool
    from_stage_id: int
    target_stage_id: int
    updated_stage_id: int
    record_version: int
    decision: EvaluationDecisionRead
    message: str
