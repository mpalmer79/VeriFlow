"""Seed demo data for VeriFlow.

Idempotent: safe to run multiple times. Creates one organization, four users
covering each role, the Healthcare Intake workflow with its nine stages, and
a small set of demo records exercising different states.
"""

from __future__ import annotations

from datetime import date
from typing import Dict, List

from sqlalchemy.orm import Session

from app.core.database import SessionLocal, engine
from app.core.security import hash_password
from app.models import (
    Base,
    Organization,
    Record,
    User,
    Workflow,
    WorkflowStage,
)
from app.models.enums import (
    ConsentStatus,
    InsuranceStatus,
    MedicalHistoryStatus,
    RecordStatus,
    RiskBand,
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
    {"name": "Ready for Scheduling", "slug": "ready_for_scheduling", "is_terminal": True},
    {"name": "Blocked", "slug": "blocked", "is_terminal": True},
    {"name": "Closed", "slug": "closed", "is_terminal": True},
]

DEMO_USERS = [
    {
        "email": "admin@veriflow.demo",
        "full_name": "Avery Chen",
        "role": UserRole.ADMIN,
    },
    {
        "email": "intake@veriflow.demo",
        "full_name": "Jordan Patel",
        "role": UserRole.INTAKE_COORDINATOR,
    },
    {
        "email": "reviewer@veriflow.demo",
        "full_name": "Morgan Reyes",
        "role": UserRole.REVIEWER,
    },
    {
        "email": "manager@veriflow.demo",
        "full_name": "Sam Whitaker",
        "role": UserRole.MANAGER,
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
        "risk_score": 10,
        "risk_band": RiskBand.LOW,
        "notes": "New referral, awaiting initial contact.",
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
        "risk_score": 35,
        "risk_band": RiskBand.MODERATE,
        "notes": "Insurance card uploaded, awaiting verification call.",
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
        "risk_score": 55,
        "risk_band": RiskBand.HIGH,
        "notes": "Consent forms sent; signature still outstanding.",
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
        "risk_score": 85,
        "risk_band": RiskBand.CRITICAL,
        "notes": "Insurance rejected and consent expired; outreach required.",
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
        "risk_score": 5,
        "risk_band": RiskBand.LOW,
        "notes": "All checks passed; ready to schedule with provider.",
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


def _ensure_records(
    db: Session,
    org: Organization,
    workflow: Workflow,
    users: Dict[UserRole, User],
) -> None:
    stage_lookup = {stage.slug: stage for stage in workflow.stages}
    intake_user = users[UserRole.INTAKE_COORDINATOR]

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
        db.add(
            Record(
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
                risk_score=entry["risk_score"],
                risk_band=entry["risk_band"],
                notes=entry["notes"],
            )
        )
    db.flush()


def seed(db: Session) -> None:
    org = _ensure_organization(db)
    users = _ensure_users(db, org)
    workflow = _ensure_workflow(db, org)
    _ensure_records(db, org, workflow, users)
    db.commit()


def run() -> None:
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed(db)
    print("Seed complete.")


if __name__ == "__main__":
    run()
