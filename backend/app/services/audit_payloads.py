"""Canonical payload builders for audit events.

Centralizing the shape of audit payloads here keeps the audit log usable
for downstream analysis: every event of the same action has the same keys
in the same order, and adding a field only changes one place.
"""

from __future__ import annotations

from typing import Any, Dict, Iterable, List, Optional

from app.models.document import Document
from app.services.evaluation_service import EvaluationDecision


def _codes(issues) -> List[str]:
    return [issue.rule_code for issue in issues]


def record_evaluated(
    *,
    record_id: int,
    current_stage_id: Optional[int],
    stage_context_id: Optional[int],
    rules_evaluated: int,
    decision: EvaluationDecision,
) -> Dict[str, Any]:
    return {
        "record_id": record_id,
        "current_stage_id": current_stage_id,
        "stage_context_id": stage_context_id,
        "rules_evaluated": rules_evaluated,
        "blocking_rule_codes": _codes(decision.violations),
        "warning_rule_codes": _codes(decision.warnings),
        "risk_score": decision.risk_score,
        "risk_band": decision.risk_band,
    }


def risk_recalculated(
    *,
    record_id: int,
    prior_risk_score: int,
    new_risk_score: int,
    risk_band: str,
) -> Dict[str, Any]:
    return {
        "record_id": record_id,
        "prior_risk_score": prior_risk_score,
        "new_risk_score": new_risk_score,
        "risk_band": risk_band,
    }


def transition_attempted(
    *,
    record_id: int,
    current_stage_id: int,
    target_stage_id: int,
) -> Dict[str, Any]:
    return {
        "record_id": record_id,
        "current_stage_id": current_stage_id,
        "target_stage_id": target_stage_id,
    }


def transition_blocked(
    *,
    record_id: int,
    current_stage_id: int,
    target_stage_id: int,
    decision: EvaluationDecision,
) -> Dict[str, Any]:
    return {
        "record_id": record_id,
        "current_stage_id": current_stage_id,
        "target_stage_id": target_stage_id,
        "blocking_rule_codes": _codes(decision.violations),
        "warning_rule_codes": _codes(decision.warnings),
        "risk_score": decision.risk_score,
        "risk_band": decision.risk_band,
    }


def transition_completed(
    *,
    record_id: int,
    prior_stage_id: int,
    new_stage_id: int,
    decision: EvaluationDecision,
) -> Dict[str, Any]:
    return {
        "record_id": record_id,
        "prior_stage_id": prior_stage_id,
        "new_stage_id": new_stage_id,
        "warning_rule_codes": _codes(decision.warnings),
        "risk_score": decision.risk_score,
        "risk_band": decision.risk_band,
    }


def document_uploaded(*, document: Document) -> Dict[str, Any]:
    return {
        "record_id": document.record_id,
        "document_id": document.id,
        "document_type": document.document_type.value,
        "document_status": document.status.value,
    }


def document_verified(*, document: Document, verified_by: int) -> Dict[str, Any]:
    return {
        "record_id": document.record_id,
        "document_id": document.id,
        "document_type": document.document_type.value,
        "document_status": document.status.value,
        "verified_by": verified_by,
    }


def document_rejected(
    *,
    document: Document,
    rejected_by: int,
    rejection_reason: Optional[str],
) -> Dict[str, Any]:
    return {
        "record_id": document.record_id,
        "document_id": document.id,
        "document_type": document.document_type.value,
        "document_status": document.status.value,
        "rejected_by": rejected_by,
        "rejection_reason": rejection_reason,
    }
