"""Integrity tests for model constraints and workflow/stage consistency."""

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.models.enums import RuleActionApplied, RuleActionType, RuleSeverity
from app.models.rule import Rule, RuleEvaluation
from app.models.workflow import Workflow, WorkflowStage


def _get_workflow(db_session, slug: str = "healthcare-intake") -> Workflow:
    return db_session.execute(select(Workflow).where(Workflow.slug == slug)).scalar_one()


def _foreign_workflow(db_session) -> Workflow:
    """Create a second workflow in the same org for cross-workflow tests."""
    primary = _get_workflow(db_session)
    other = Workflow(
        organization_id=primary.organization_id,
        name="Secondary Flow",
        slug="secondary-flow",
        description="Secondary workflow used only by integrity tests.",
    )
    db_session.add(other)
    db_session.flush()
    db_session.add(
        WorkflowStage(
            workflow_id=other.id,
            name="Start",
            slug="start",
            order_index=0,
            is_terminal=False,
        )
    )
    db_session.commit()
    db_session.refresh(other)
    return other


# --- workflow-stage consistency on create ----------------------------------


def test_create_record_rejects_stage_from_other_workflow(
    client, auth_headers, db_session
):
    primary = _get_workflow(db_session)
    other = _foreign_workflow(db_session)
    other_stage = other.stages[0] if other.stages else db_session.execute(
        select(WorkflowStage).where(WorkflowStage.workflow_id == other.id)
    ).scalar_one()

    response = client.post(
        "/api/records",
        headers=auth_headers,
        json={
            "workflow_id": primary.id,
            "current_stage_id": other_stage.id,
            "subject_full_name": "Integrity Check",
        },
    )
    assert response.status_code == 400
    assert "does not belong" in response.json()["detail"].lower()


def test_create_record_with_valid_stage_succeeds(client, auth_headers, db_session):
    workflow = _get_workflow(db_session)
    stages = db_session.execute(
        select(WorkflowStage)
        .where(WorkflowStage.workflow_id == workflow.id)
        .order_by(WorkflowStage.order_index)
    ).scalars().all()
    chosen = stages[2]  # pick a non-default stage to prove it is honored

    response = client.post(
        "/api/records",
        headers=auth_headers,
        json={
            "workflow_id": workflow.id,
            "current_stage_id": chosen.id,
            "subject_full_name": "Valid Stage",
        },
    )
    assert response.status_code == 201, response.text
    assert response.json()["current_stage_id"] == chosen.id


# --- workflow-stage consistency on update ----------------------------------


def test_update_record_rejects_stage_from_other_workflow(
    client, auth_headers, db_session
):
    other = _foreign_workflow(db_session)
    other_stage_id = db_session.execute(
        select(WorkflowStage).where(WorkflowStage.workflow_id == other.id)
    ).scalar_one().id

    listing = client.get("/api/records", headers=auth_headers).json()
    record_id = listing[0]["id"]

    response = client.patch(
        f"/api/records/{record_id}",
        headers=auth_headers,
        json={"current_stage_id": other_stage_id},
    )
    assert response.status_code == 400
    assert "does not belong" in response.json()["detail"].lower()


def test_update_record_accepts_same_workflow_stage(client, auth_headers, db_session):
    workflow = _get_workflow(db_session)
    stages = db_session.execute(
        select(WorkflowStage)
        .where(WorkflowStage.workflow_id == workflow.id)
        .order_by(WorkflowStage.order_index)
    ).scalars().all()
    target_stage_id = stages[1].id

    listing = client.get("/api/records", headers=auth_headers).json()
    record_id = listing[0]["id"]

    response = client.patch(
        f"/api/records/{record_id}",
        headers=auth_headers,
        json={"current_stage_id": target_stage_id},
    )
    assert response.status_code == 200
    assert response.json()["current_stage_id"] == target_stage_id


def test_update_record_rejects_unknown_stage(client, auth_headers):
    listing = client.get("/api/records", headers=auth_headers).json()
    record_id = listing[0]["id"]

    response = client.patch(
        f"/api/records/{record_id}",
        headers=auth_headers,
        json={"current_stage_id": 999999},
    )
    assert response.status_code == 400


# --- rule code uniqueness scope --------------------------------------------


def test_rule_code_unique_per_workflow(db_session):
    primary = _get_workflow(db_session)
    other = _foreign_workflow(db_session)

    db_session.add(
        Rule(
            workflow_id=primary.id,
            code="insurance.status_known",
            name="Insurance must be known",
            action=RuleActionType.BLOCK,
            severity=RuleSeverity.HIGH,
            risk_weight=20,
        )
    )
    db_session.add(
        Rule(
            workflow_id=other.id,
            code="insurance.status_known",
            name="Insurance must be known (secondary)",
            action=RuleActionType.WARN,
            severity=RuleSeverity.WARNING,
            risk_weight=5,
        )
    )
    db_session.commit()

    rules = db_session.execute(
        select(Rule).where(Rule.code == "insurance.status_known")
    ).scalars().all()
    assert len(rules) == 2
    assert {r.workflow_id for r in rules} == {primary.id, other.id}


def test_rule_code_unique_within_same_workflow(db_session):
    workflow = _get_workflow(db_session)
    db_session.add(
        Rule(
            workflow_id=workflow.id,
            code="consent.signature_required",
            name="Consent signature required",
            action=RuleActionType.BLOCK,
            severity=RuleSeverity.HIGH,
            risk_weight=30,
        )
    )
    db_session.commit()

    duplicate = Rule(
        workflow_id=workflow.id,
        code="consent.signature_required",
        name="Duplicate",
        action=RuleActionType.WARN,
        severity=RuleSeverity.WARNING,
        risk_weight=10,
    )
    db_session.add(duplicate)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


# --- rule evaluation semantics ---------------------------------------------


def test_rule_evaluation_persists_new_fields(db_session):
    workflow = _get_workflow(db_session)
    rule = Rule(
        workflow_id=workflow.id,
        code="documents.expired",
        name="Expired documents contribute risk",
        action=RuleActionType.WARN,
        severity=RuleSeverity.WARNING,
        risk_weight=15,
    )
    db_session.add(rule)
    db_session.flush()

    from app.models.record import Record  # local import to avoid circular test deps

    record = db_session.execute(select(Record).limit(1)).scalar_one()

    evaluation = RuleEvaluation(
        record_id=record.id,
        rule_id=rule.id,
        passed=False,
        action_applied=RuleActionApplied.WARN,
        risk_applied=15,
        explanation="Document 'insurance_card' is expired.",
    )
    db_session.add(evaluation)
    db_session.commit()
    db_session.refresh(evaluation)

    assert evaluation.passed is False
    assert evaluation.action_applied == RuleActionApplied.WARN
    assert evaluation.risk_applied == 15
    assert evaluation.explanation.startswith("Document")
