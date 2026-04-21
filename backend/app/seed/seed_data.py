"""Seed demo data for VeriFlow.

Idempotent: safe to run multiple times. Creates one organization, four users
covering each role, the Healthcare Intake workflow with its nine stages,
the initial rule set, and a small set of demo records exercising different
states.

Gated: refuses to execute against a non-dev environment unless the operator
opts in explicitly via ``VERIFLOW_ALLOW_SEED=true``. This keeps Railway /
production deploys from accidentally materializing the demo accounts, whose
shared password is well known.
"""

from __future__ import annotations

import os
from datetime import date
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import SessionLocal, engine
from app.core.security import hash_password
from app.models import (
    Base,
    Document,
    DocumentRequirement,
    Organization,
    Record,
    Rule,
    User,
    Workflow,
    WorkflowStage,
)
from app.models.enums import (
    ConsentStatus,
    DocumentStatus,
    DocumentType,
    InsuranceStatus,
    MedicalHistoryStatus,
    RecordStatus,
    RiskBand,
    RuleActionType,
    RuleSeverity,
    UserRole,
)
from app.repositories import user_repository

DEFAULT_PASSWORD = "VeriFlow!2025"

WORKFLOW_STAGES: List[Dict] = [
    {"name": "New Intake", "slug": "new_intake", "is_terminal": False},
    {"name": "Identity Verification", "slug": "identity_verification", "is_terminal": False},
    {"name": "Insurance Review", "slug": "insurance_review", "is_terminal": False},
    {"name": "Consent & Authorization", "slug": "consent_authorization", "is_terminal": False},
    {"name": "Clinical History Review", "slug": "clinical_history_review", "is_terminal": False},
    {"name": "Provider Triage", "slug": "provider_triage", "is_terminal": False},
    {"name": "Ready for Scheduling", "slug": "ready_for_scheduling", "is_terminal": False},
    {"name": "Blocked", "slug": "blocked", "is_terminal": True},
    {"name": "Closed", "slug": "closed", "is_terminal": True},
]

DEMO_USERS = [
    {"email": "admin@veriflow.demo", "full_name": "Avery Chen", "role": UserRole.ADMIN},
    {
        "email": "intake@veriflow.demo",
        "full_name": "Jordan Patel",
        "role": UserRole.INTAKE_COORDINATOR,
    },
    {"email": "reviewer@veriflow.demo", "full_name": "Morgan Reyes", "role": UserRole.REVIEWER},
    {"email": "manager@veriflow.demo", "full_name": "Sam Whitaker", "role": UserRole.MANAGER},
]

# stage_slug is optional; None means the rule is workflow-global.
# Document requirements scoped by stage. `stage_slug=None` means workflow-global.
INITIAL_DOCUMENT_REQUIREMENTS: List[Dict] = [
    {
        "document_type": DocumentType.PHOTO_ID,
        "stage_slug": "identity_verification",
        "is_required": True,
    },
    {
        "document_type": DocumentType.INSURANCE_CARD,
        "stage_slug": "insurance_review",
        "is_required": True,
    },
    {
        "document_type": DocumentType.CONSENT_FORM,
        "stage_slug": "consent_authorization",
        "is_required": True,
    },
    {
        "document_type": DocumentType.GUARDIAN_AUTHORIZATION,
        "stage_slug": "consent_authorization",
        "is_required": True,
        "applies_when_code": "subject_is_minor",
    },
    {
        "document_type": DocumentType.MEDICAL_HISTORY_FORM,
        "stage_slug": "clinical_history_review",
        "is_required": True,
    },
]


INITIAL_RULES: List[Dict] = [
    {
        "code": "identity_required",
        "name": "Identity must be verified",
        "description": "Blocks progression past Identity Verification until identity is verified.",
        "stage_slug": "identity_verification",
        "action": RuleActionType.BLOCK,
        "severity": RuleSeverity.HIGH,
        "risk_weight": 40,
    },
    {
        "code": "insurance_verified_or_self_pay",
        "name": "Insurance verified or self-pay acknowledged",
        "description": "Blocks progression past Insurance Review until coverage is verified or self-pay is acknowledged.",
        "stage_slug": "insurance_review",
        "action": RuleActionType.BLOCK,
        "severity": RuleSeverity.HIGH,
        "risk_weight": 45,
    },
    {
        "code": "consent_required",
        "name": "Signed consent required",
        "description": "Blocks progression past Consent & Authorization without a current signed consent.",
        "stage_slug": "consent_authorization",
        "action": RuleActionType.BLOCK,
        "severity": RuleSeverity.CRITICAL,
        "risk_weight": 50,
    },
    {
        "code": "guardian_authorization_required",
        "name": "Guardian authorization required for minors",
        "description": "Blocks progression for subjects under 18 without guardian authorization.",
        "stage_slug": "consent_authorization",
        "action": RuleActionType.BLOCK,
        "severity": RuleSeverity.CRITICAL,
        "risk_weight": 60,
    },
    {
        "code": "medical_history_warning",
        "name": "Medical history incomplete",
        "description": "Warns when medical history is not complete; does not block.",
        "stage_slug": "clinical_history_review",
        "action": RuleActionType.WARN,
        "severity": RuleSeverity.WARNING,
        "risk_weight": 15,
    },
    {
        "code": "allergy_warning",
        "name": "Allergy information missing",
        "description": "Warns when allergy information has not been provided; does not block.",
        "stage_slug": "clinical_history_review",
        "action": RuleActionType.WARN,
        "severity": RuleSeverity.WARNING,
        "risk_weight": 10,
    },
    {
        "code": "out_of_network_warning",
        "name": "Out-of-network coverage",
        "description": "Warns when insurance coverage is out-of-network; does not block.",
        "stage_slug": "insurance_review",
        "action": RuleActionType.WARN,
        "severity": RuleSeverity.WARNING,
        "risk_weight": 20,
    },
]

DEMO_RECORDS = [
    {
        "subject_full_name": "Riley Thompson",
        "subject_dob": date(1988, 3, 14),
        "external_reference": "INT-1001",
        "stage_slug": "new_intake",
        "status": RecordStatus.DRAFT,
        "insurance_status": InsuranceStatus.UNKNOWN,
        "consent_status": ConsentStatus.NOT_PROVIDED,
        "medical_history_status": MedicalHistoryStatus.NOT_STARTED,
        "identity_verified": False,
        "guardian_authorization_signed": False,
        "allergy_info_provided": False,
        "insurance_in_network": None,
        "notes": "New referral, awaiting initial contact.",
        "documents": [],
    },
    {
        "subject_full_name": "Casey Nguyen",
        "subject_dob": date(1972, 11, 2),
        "external_reference": "INT-1002",
        "stage_slug": "insurance_review",
        "status": RecordStatus.IN_PROGRESS,
        "insurance_status": InsuranceStatus.PENDING,
        "consent_status": ConsentStatus.PARTIAL,
        "medical_history_status": MedicalHistoryStatus.INCOMPLETE,
        "identity_verified": True,
        "guardian_authorization_signed": False,
        "allergy_info_provided": False,
        "insurance_in_network": None,
        "notes": "Insurance card uploaded, awaiting verification call.",
        "documents": [
            {
                "document_type": DocumentType.PHOTO_ID,
                "status": DocumentStatus.VERIFIED,
                "label": "Driver's license scan",
            },
            {
                "document_type": DocumentType.INSURANCE_CARD,
                "status": DocumentStatus.UPLOADED,
                "label": "Front/back insurance card",
            },
        ],
    },
    {
        "subject_full_name": "Devon Alvarez",
        "subject_dob": date(1995, 7, 22),
        "external_reference": "INT-1003",
        "stage_slug": "consent_authorization",
        "status": RecordStatus.IN_PROGRESS,
        "insurance_status": InsuranceStatus.VERIFIED,
        "consent_status": ConsentStatus.NOT_PROVIDED,
        "medical_history_status": MedicalHistoryStatus.INCOMPLETE,
        "identity_verified": True,
        "guardian_authorization_signed": False,
        "allergy_info_provided": True,
        "insurance_in_network": True,
        "notes": "Consent forms sent; signature still outstanding.",
        "documents": [
            {
                "document_type": DocumentType.PHOTO_ID,
                "status": DocumentStatus.VERIFIED,
                "label": "Passport scan",
            },
            {
                "document_type": DocumentType.INSURANCE_CARD,
                "status": DocumentStatus.VERIFIED,
                "label": "Insurance card (verified)",
            },
        ],
    },
    {
        "subject_full_name": "Harper Kim",
        "subject_dob": date(1960, 1, 8),
        "external_reference": "INT-1004",
        "stage_slug": "blocked",
        "status": RecordStatus.BLOCKED,
        "insurance_status": InsuranceStatus.INVALID,
        "consent_status": ConsentStatus.EXPIRED,
        "medical_history_status": MedicalHistoryStatus.INCOMPLETE,
        "identity_verified": True,
        "guardian_authorization_signed": False,
        "allergy_info_provided": False,
        "insurance_in_network": False,
        "notes": "Insurance rejected and consent expired; outreach required.",
        "documents": [
            {
                "document_type": DocumentType.PHOTO_ID,
                "status": DocumentStatus.VERIFIED,
                "label": "State ID",
            },
            {
                "document_type": DocumentType.INSURANCE_CARD,
                "status": DocumentStatus.REJECTED,
                "label": "Insurance card (rejected)",
                "rejection_reason": "Coverage terminated on effective date.",
            },
            {
                "document_type": DocumentType.CONSENT_FORM,
                "status": DocumentStatus.REJECTED,
                "label": "Consent form (expired)",
                "rejection_reason": "Signature date outside validity window.",
            },
        ],
    },
    {
        "subject_full_name": "Quinn Foster",
        "subject_dob": date(1983, 9, 30),
        "external_reference": "INT-1005",
        "stage_slug": "ready_for_scheduling",
        "status": RecordStatus.READY,
        "insurance_status": InsuranceStatus.VERIFIED,
        "consent_status": ConsentStatus.SIGNED,
        "medical_history_status": MedicalHistoryStatus.COMPLETE,
        "identity_verified": True,
        "guardian_authorization_signed": False,
        "allergy_info_provided": True,
        "insurance_in_network": True,
        "notes": "All checks passed; ready to schedule with provider.",
        "documents": [
            {
                "document_type": DocumentType.PHOTO_ID,
                "status": DocumentStatus.VERIFIED,
                "label": "Driver's license",
            },
            {
                "document_type": DocumentType.INSURANCE_CARD,
                "status": DocumentStatus.VERIFIED,
                "label": "Insurance card",
            },
            {
                "document_type": DocumentType.CONSENT_FORM,
                "status": DocumentStatus.VERIFIED,
                "label": "Signed consent",
            },
            {
                "document_type": DocumentType.MEDICAL_HISTORY_FORM,
                "status": DocumentStatus.VERIFIED,
                "label": "Medical history",
            },
        ],
    },
]


def _ensure_organization(db: Session) -> Organization:
    org = db.query(Organization).filter_by(slug="veriflow-demo").one_or_none()
    if org is None:
        org = Organization(name="VeriFlow Demo Clinic", slug="veriflow-demo")
        db.add(org)
        db.flush()
    return org


def _ensure_users(db: Session, org: Organization) -> Dict[UserRole, User]:
    out: Dict[UserRole, User] = {}
    for entry in DEMO_USERS:
        existing = user_repository.get_by_email(db, entry["email"])
        if existing is None:
            user = User(
                organization_id=org.id,
                email=entry["email"].lower(),
                full_name=entry["full_name"],
                hashed_password=hash_password(DEFAULT_PASSWORD),
                role=entry["role"],
                is_active=True,
            )
            db.add(user)
            db.flush()
            out[entry["role"]] = user
        else:
            out[entry["role"]] = existing
    return out


def _ensure_workflow(db: Session, org: Organization) -> Workflow:
    workflow = (
        db.query(Workflow)
        .filter_by(organization_id=org.id, slug="healthcare-intake")
        .one_or_none()
    )
    if workflow is None:
        workflow = Workflow(
            organization_id=org.id,
            name="Healthcare Intake",
            slug="healthcare-intake",
            description="Demonstration intake workflow for new patient onboarding.",
        )
        db.add(workflow)
        db.flush()

    existing_slugs = {stage.slug for stage in workflow.stages}
    for index, stage_def in enumerate(WORKFLOW_STAGES):
        if stage_def["slug"] in existing_slugs:
            continue
        db.add(
            WorkflowStage(
                workflow_id=workflow.id,
                name=stage_def["name"],
                slug=stage_def["slug"],
                order_index=index,
                is_terminal=stage_def["is_terminal"],
            )
        )
    db.flush()
    db.refresh(workflow)
    return workflow


def _ensure_rules(db: Session, workflow: Workflow) -> None:
    stage_lookup = {stage.slug: stage for stage in workflow.stages}
    existing_codes = {
        rule.code for rule in db.query(Rule).filter_by(workflow_id=workflow.id).all()
    }

    for entry in INITIAL_RULES:
        if entry["code"] in existing_codes:
            continue
        stage_slug: Optional[str] = entry.get("stage_slug")
        stage_id = stage_lookup[stage_slug].id if stage_slug else None
        db.add(
            Rule(
                workflow_id=workflow.id,
                stage_id=stage_id,
                code=entry["code"],
                name=entry["name"],
                description=entry["description"],
                action=entry["action"],
                severity=entry["severity"],
                risk_weight=entry["risk_weight"],
                is_active=True,
            )
        )
    db.flush()


def _ensure_document_requirements(db: Session, workflow: Workflow) -> None:
    stage_lookup = {stage.slug: stage for stage in workflow.stages}
    existing = {
        (req.stage_id, req.document_type)
        for req in db.query(DocumentRequirement).filter_by(workflow_id=workflow.id).all()
    }
    for entry in INITIAL_DOCUMENT_REQUIREMENTS:
        stage_slug = entry.get("stage_slug")
        stage_id = stage_lookup[stage_slug].id if stage_slug else None
        key = (stage_id, entry["document_type"])
        if key in existing:
            continue
        db.add(
            DocumentRequirement(
                workflow_id=workflow.id,
                stage_id=stage_id,
                document_type=entry["document_type"],
                is_required=entry.get("is_required", True),
                applies_when_code=entry.get("applies_when_code"),
            )
        )
    db.flush()


def _ensure_records(
    db: Session,
    org: Organization,
    workflow: Workflow,
    users: Dict[UserRole, User],
) -> None:
    stage_lookup = {stage.slug: stage for stage in workflow.stages}
    intake_user = users[UserRole.INTAKE_COORDINATOR]
    reviewer = users[UserRole.REVIEWER]

    for entry in DEMO_RECORDS:
        existing = (
            db.query(Record)
            .filter_by(
                organization_id=org.id,
                external_reference=entry["external_reference"],
            )
            .one_or_none()
        )
        if existing is not None:
            continue
        stage = stage_lookup[entry["stage_slug"]]
        record = Record(
            organization_id=org.id,
            workflow_id=workflow.id,
            current_stage_id=stage.id,
            assigned_user_id=intake_user.id,
            external_reference=entry["external_reference"],
            subject_full_name=entry["subject_full_name"],
            subject_dob=entry["subject_dob"],
            status=entry["status"],
            insurance_status=entry["insurance_status"],
            consent_status=entry["consent_status"],
            medical_history_status=entry["medical_history_status"],
            identity_verified=entry["identity_verified"],
            guardian_authorization_signed=entry["guardian_authorization_signed"],
            allergy_info_provided=entry["allergy_info_provided"],
            insurance_in_network=entry["insurance_in_network"],
            risk_score=0,
            risk_band=RiskBand.LOW,
            notes=entry["notes"],
        )
        db.add(record)
        db.flush()

        from datetime import datetime, timezone

        now = datetime.now(timezone.utc)
        for doc_entry in entry.get("documents", []):
            doc_kwargs = dict(
                record_id=record.id,
                document_type=doc_entry["document_type"],
                label=doc_entry.get("label"),
                notes=doc_entry.get("notes"),
                status=doc_entry["status"],
            )
            if doc_entry["status"] == DocumentStatus.VERIFIED:
                doc_kwargs["verified_by_user_id"] = reviewer.id
                doc_kwargs["verified_at"] = now
            elif doc_entry["status"] == DocumentStatus.REJECTED:
                doc_kwargs["rejected_by_user_id"] = reviewer.id
                doc_kwargs["rejected_at"] = now
                doc_kwargs["rejection_reason"] = doc_entry.get("rejection_reason")
            db.add(Document(**doc_kwargs))
    db.flush()


def seed(db: Session) -> None:
    org = _ensure_organization(db)
    users = _ensure_users(db, org)
    workflow = _ensure_workflow(db, org)
    _ensure_rules(db, workflow)
    _ensure_document_requirements(db, workflow)
    _ensure_records(db, org, workflow, users)
    db.commit()


class SeedNotAllowedError(RuntimeError):
    """Raised when `run()` is invoked outside a dev-like environment."""


def _seed_allowed() -> bool:
    if get_settings().is_dev_like:
        return True
    override = os.getenv("VERIFLOW_ALLOW_SEED", "").strip().lower()
    return override in {"1", "true", "yes", "on"}


def run(*, force: bool = False) -> None:
    if not force and not _seed_allowed():
        raise SeedNotAllowedError(
            "Refusing to seed: APP_ENV is not dev-like. "
            "Set VERIFLOW_ALLOW_SEED=true to override."
        )
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed(db)
    print("Seed complete.")


if __name__ == "__main__":
    import sys

    try:
        run()
    except SeedNotAllowedError as exc:
        print(f"seed_data: {exc}", file=sys.stderr)
        sys.exit(2)
