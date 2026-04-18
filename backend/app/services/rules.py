"""Built-in rule evaluators for the Healthcare Intake workflow.

Each evaluator is registered by its rule code. The registry is imported at
the bottom of `rule_engine_service` so these evaluators become available
as soon as the engine module is loaded.

Evidence model (Phase 3):
    Several rules prefer document evidence (verified `Document` rows of a
    specific type) but still honour the legacy boolean flags on `Record`.
    This hybrid keeps earlier records meaningful while making verified
    documents the primary signal going forward.
"""

from __future__ import annotations

from datetime import date
from typing import Optional

from app.models.enums import (
    ConsentStatus,
    DocumentType,
    InsuranceStatus,
    MedicalHistoryStatus,
)
from app.models.record import Record
from app.models.rule import Rule
from app.repositories import document_repository as doc_repo
from app.services.rule_engine_service import RuleResult, apply, register


def _age_years(dob: Optional[date], reference: Optional[date] = None) -> Optional[int]:
    if dob is None:
        return None
    today = reference or date.today()
    years = today.year - dob.year
    if (today.month, today.day) < (dob.month, dob.day):
        years -= 1
    return years


@register("identity_required")
def identity_required(record: Record, rule: Rule) -> RuleResult:
    has_verified_photo_id = doc_repo.has_verified(record, DocumentType.PHOTO_ID)
    passed = has_verified_photo_id or bool(record.identity_verified)
    if passed:
        message = (
            "Identity verified via photo_id document."
            if has_verified_photo_id
            else "Identity verified."
        )
    else:
        message = (
            "A verified photo_id document (or identity verification) is required "
            "before advancing past Identity Verification."
        )
    return apply(rule, passed=passed, message=message)


@register("insurance_verified_or_self_pay")
def insurance_verified_or_self_pay(record: Record, rule: Rule) -> RuleResult:
    accepted = {InsuranceStatus.VERIFIED, InsuranceStatus.UNINSURED_ACKNOWLEDGED}
    status_ok = record.insurance_status in accepted
    card_verified = doc_repo.has_verified(record, DocumentType.INSURANCE_CARD)
    passed = status_ok or card_verified

    if passed:
        if record.insurance_status == InsuranceStatus.UNINSURED_ACKNOWLEDGED:
            message = "Self-pay acknowledged."
        elif card_verified:
            message = "Insurance verified via insurance_card document."
        else:
            message = "Insurance verified."
    else:
        message = (
            "Insurance must be verified (via verified insurance_card or status) "
            "or self-pay must be acknowledged before advancing past Insurance Review."
        )
    return apply(rule, passed=passed, message=message)


@register("consent_required")
def consent_required(record: Record, rule: Rule) -> RuleResult:
    consent_doc_verified = doc_repo.has_verified(record, DocumentType.CONSENT_FORM)
    status_signed = record.consent_status == ConsentStatus.SIGNED
    passed = consent_doc_verified or status_signed

    if passed:
        message = (
            "Consent verified via consent_form document."
            if consent_doc_verified
            else "Consent signed and current."
        )
    elif record.consent_status == ConsentStatus.EXPIRED:
        message = "Consent on file is expired; a current signed consent is required."
    else:
        message = (
            "A verified consent_form document (or signed consent status) is required "
            "before advancing past Consent & Authorization."
        )
    return apply(rule, passed=passed, message=message)


@register("guardian_authorization_required")
def guardian_authorization_required(record: Record, rule: Rule) -> RuleResult:
    age = _age_years(record.subject_dob)
    if age is None or age >= 18:
        return apply(rule, passed=True, message="Guardian authorization not required.")

    guardian_doc_verified = doc_repo.has_verified(
        record, DocumentType.GUARDIAN_AUTHORIZATION
    )
    passed = guardian_doc_verified or bool(record.guardian_authorization_signed)
    if passed:
        message = (
            "Guardian authorization verified via guardian_authorization document."
            if guardian_doc_verified
            else "Guardian authorization on file."
        )
    else:
        message = (
            "Subject is a minor; a verified guardian_authorization document "
            "(or signed authorization flag) is required before advancing."
        )
    return apply(rule, passed=passed, message=message)


@register("medical_history_warning")
def medical_history_warning(record: Record, rule: Rule) -> RuleResult:
    history_doc_verified = doc_repo.has_verified(
        record, DocumentType.MEDICAL_HISTORY_FORM
    )
    status_complete = record.medical_history_status == MedicalHistoryStatus.COMPLETE
    passed = history_doc_verified or status_complete
    if passed:
        message = (
            "Medical history complete via medical_history_form document."
            if history_doc_verified
            else "Medical history complete."
        )
    else:
        message = "Medical history is incomplete; progression allowed but review is recommended."
    return apply(rule, passed=passed, message=message)


@register("allergy_warning")
def allergy_warning(record: Record, rule: Rule) -> RuleResult:
    passed = bool(record.allergy_info_provided)
    message = (
        "Allergy information on file."
        if passed
        else "Allergy information is missing; progression allowed but review is recommended."
    )
    return apply(rule, passed=passed, message=message)


@register("out_of_network_warning")
def out_of_network_warning(record: Record, rule: Rule) -> RuleResult:
    if record.insurance_status == InsuranceStatus.UNINSURED_ACKNOWLEDGED:
        return apply(rule, passed=True, message="Self-pay; network status not applicable.")
    if record.insurance_in_network is False:
        return apply(
            rule,
            passed=False,
            message="Insurance indicates out-of-network handling; surcharge workflow applies.",
        )
    return apply(rule, passed=True, message="Insurance network status acceptable.")
