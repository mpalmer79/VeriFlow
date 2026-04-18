"""Built-in rule evaluators for the Healthcare Intake workflow.

Each evaluator is registered by its rule code. The registry is imported at
the bottom of `rule_engine_service` so these evaluators become available
as soon as the engine module is loaded.
"""

from __future__ import annotations

from datetime import date
from typing import Optional

from app.models.enums import ConsentStatus, InsuranceStatus, MedicalHistoryStatus
from app.models.record import Record
from app.models.rule import Rule
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
    passed = bool(record.identity_verified)
    message = (
        "Identity verified."
        if passed
        else "Identity verification is required before advancing past Identity Verification."
    )
    return apply(rule, passed=passed, message=message)


@register("insurance_verified_or_self_pay")
def insurance_verified_or_self_pay(record: Record, rule: Rule) -> RuleResult:
    accepted = {InsuranceStatus.VERIFIED, InsuranceStatus.UNINSURED_ACKNOWLEDGED}
    passed = record.insurance_status in accepted
    if passed:
        message = "Insurance verified or self-pay acknowledged."
    else:
        message = (
            "Insurance must be verified or self-pay must be acknowledged before "
            "advancing past Insurance Review."
        )
    return apply(rule, passed=passed, message=message)


@register("consent_required")
def consent_required(record: Record, rule: Rule) -> RuleResult:
    passed = record.consent_status == ConsentStatus.SIGNED
    if passed:
        message = "Consent signed and current."
    elif record.consent_status == ConsentStatus.EXPIRED:
        message = "Consent on file is expired; a current signed consent is required."
    else:
        message = "Signed consent is required before advancing past Consent & Authorization."
    return apply(rule, passed=passed, message=message)


@register("guardian_authorization_required")
def guardian_authorization_required(record: Record, rule: Rule) -> RuleResult:
    age = _age_years(record.subject_dob)
    if age is None or age >= 18:
        return apply(rule, passed=True, message="Guardian authorization not required.")

    passed = bool(record.guardian_authorization_signed)
    message = (
        "Guardian authorization on file."
        if passed
        else "Subject is a minor; guardian authorization is required before advancing."
    )
    return apply(rule, passed=passed, message=message)


@register("medical_history_warning")
def medical_history_warning(record: Record, rule: Rule) -> RuleResult:
    passed = record.medical_history_status == MedicalHistoryStatus.COMPLETE
    message = (
        "Medical history complete."
        if passed
        else "Medical history is incomplete; progression allowed but review is recommended."
    )
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
    # A record passes this rule if coverage is known to be in-network or if
    # the subject is self-pay. Out-of-network coverage warns but does not
    # block; unknown coverage is treated as acceptable until verified.
    if record.insurance_status == InsuranceStatus.UNINSURED_ACKNOWLEDGED:
        return apply(rule, passed=True, message="Self-pay; network status not applicable.")
    if record.insurance_in_network is False:
        return apply(
            rule,
            passed=False,
            message="Insurance indicates out-of-network handling; surcharge workflow applies.",
        )
    return apply(rule, passed=True, message="Insurance network status acceptable.")
