"""End-to-end tests for Phase 2: evaluation, risk, and workflow transitions.

These tests go through the FastAPI client to exercise routes, services,
the rule registry, persistence, and audit logging together.
"""

from datetime import date, timedelta

import pytest
from sqlalchemy import select

from app.models.audit import AuditLog
from app.models.rule import Rule, RuleEvaluation
from app.models.workflow import Workflow, WorkflowStage


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------


def _workflow(db_session) -> Workflow:
    return db_session.execute(
        select(Workflow).where(Workflow.slug == "healthcare-intake")
    ).scalar_one()


def _stage_ids(db_session):
    workflow = _workflow(db_session)
    stages = db_session.execute(
        select(WorkflowStage)
        .where(WorkflowStage.workflow_id == workflow.id)
        .order_by(WorkflowStage.order_index)
    ).scalars().all()
    return {stage.slug: stage.id for stage in stages}, workflow


def _app_stage_ids():
    """Resolve stage ids using the app's (possibly monkey-patched) session factory."""
    from app.core import database as db_module

    with db_module.SessionLocal() as db:
        stages, _ = _stage_ids(db)
    return stages


def _create_record(client, auth_headers, workflow_id, **overrides):
    # Default to Clinical History Review so all seven rules are in scope under
    # stage-aware filtering; individual tests can pass current_stage_id=None
    # to leave the record at the workflow's first stage.
    stage_override = overrides.pop("current_stage_id", "default")
    payload = {
        "workflow_id": workflow_id,
        "subject_full_name": overrides.pop("subject_full_name", "Test Subject"),
        "subject_dob": overrides.pop("subject_dob", "1990-01-01"),
        "external_reference": overrides.pop("external_reference", None),
        "insurance_status": "unknown",
        "consent_status": "not_provided",
        "medical_history_status": "not_started",
        "identity_verified": False,
        "guardian_authorization_signed": False,
        "allergy_info_provided": False,
        "insurance_in_network": None,
    }
    payload.update(overrides)
    payload = {k: v for k, v in payload.items() if v is not None or k == "insurance_in_network"}
    response = client.post("/api/records", json=payload, headers=auth_headers)
    assert response.status_code == 201, response.text
    record = response.json()

    if stage_override == "default":
        target = _app_stage_ids()["clinical_history_review"]
    elif stage_override is None:
        target = None
    else:
        target = stage_override

    if target is not None and record["current_stage_id"] != target:
        patch = client.patch(
            f"/api/records/{record['id']}",
            json={"current_stage_id": target},
            headers=auth_headers,
        )
        assert patch.status_code == 200, patch.text
        record = patch.json()
    return record


def _patch_record(client, auth_headers, record_id, **fields):
    response = client.patch(f"/api/records/{record_id}", json=fields, headers=auth_headers)
    assert response.status_code == 200, response.text
    return response.json()


def _evaluate(client, auth_headers, record_id):
    response = client.post(f"/api/records/{record_id}/evaluate", headers=auth_headers)
    assert response.status_code == 200, response.text
    return response.json()


# --------------------------------------------------------------------------
# blocking rule coverage
# --------------------------------------------------------------------------


def test_evaluate_blocks_when_identity_missing(client, auth_headers, db_session):
    _, workflow = _stage_ids(db_session)
    record = _create_record(client, auth_headers, workflow.id)
    decision = _evaluate(client, auth_headers, record["id"])

    violation_codes = [v["rule_code"] for v in decision["violations"]]
    assert "identity_required" in violation_codes
    assert decision["can_progress"] is False
    assert decision["risk_score"] >= 40


def test_evaluate_blocks_when_insurance_unresolved(client, auth_headers, db_session):
    _, workflow = _stage_ids(db_session)
    record = _create_record(client, auth_headers, workflow.id, identity_verified=True)
    decision = _evaluate(client, auth_headers, record["id"])

    violation_codes = [v["rule_code"] for v in decision["violations"]]
    assert "insurance_verified_or_self_pay" in violation_codes
    assert decision["can_progress"] is False


def test_evaluate_blocks_when_consent_missing(client, auth_headers, db_session):
    _, workflow = _stage_ids(db_session)
    record = _create_record(
        client,
        auth_headers,
        workflow.id,
        identity_verified=True,
        insurance_status="verified",
        insurance_in_network=True,
    )
    decision = _evaluate(client, auth_headers, record["id"])
    violation_codes = [v["rule_code"] for v in decision["violations"]]
    assert "consent_required" in violation_codes


def test_evaluate_blocks_minor_without_guardian_authorization(
    client, auth_headers, db_session
):
    _, workflow = _stage_ids(db_session)
    dob = (date.today() - timedelta(days=365 * 12)).isoformat()  # 12-year-old
    record = _create_record(
        client,
        auth_headers,
        workflow.id,
        subject_dob=dob,
        identity_verified=True,
        insurance_status="verified",
        insurance_in_network=True,
        consent_status="signed",
    )
    decision = _evaluate(client, auth_headers, record["id"])
    violation_codes = [v["rule_code"] for v in decision["violations"]]
    assert "guardian_authorization_required" in violation_codes
    assert decision["can_progress"] is False

    # Once the guardian auth is signed, the block clears.
    _patch_record(client, auth_headers, record["id"], guardian_authorization_signed=True)
    decision_after = _evaluate(client, auth_headers, record["id"])
    violation_codes_after = [v["rule_code"] for v in decision_after["violations"]]
    assert "guardian_authorization_required" not in violation_codes_after


# --------------------------------------------------------------------------
# warning rule coverage
# --------------------------------------------------------------------------


def test_incomplete_medical_history_warns_without_blocking(
    client, auth_headers, db_session
):
    _, workflow = _stage_ids(db_session)
    record = _create_record(
        client,
        auth_headers,
        workflow.id,
        identity_verified=True,
        insurance_status="verified",
        insurance_in_network=True,
        consent_status="signed",
        medical_history_status="incomplete",
        allergy_info_provided=True,
    )
    decision = _evaluate(client, auth_headers, record["id"])
    warning_codes = [w["rule_code"] for w in decision["warnings"]]
    assert "medical_history_warning" in warning_codes
    assert decision["can_progress"] is True


def test_missing_allergy_info_warns_without_blocking(client, auth_headers, db_session):
    _, workflow = _stage_ids(db_session)
    record = _create_record(
        client,
        auth_headers,
        workflow.id,
        identity_verified=True,
        insurance_status="verified",
        insurance_in_network=True,
        consent_status="signed",
        medical_history_status="complete",
        allergy_info_provided=False,
    )
    decision = _evaluate(client, auth_headers, record["id"])
    warning_codes = [w["rule_code"] for w in decision["warnings"]]
    assert "allergy_warning" in warning_codes
    assert decision["can_progress"] is True


# --------------------------------------------------------------------------
# aggregate risk behavior
# --------------------------------------------------------------------------


def test_aggregate_risk_score_is_sum_of_triggered_weights(
    client, auth_headers, db_session
):
    _, workflow = _stage_ids(db_session)
    # No identity (40), no insurance (45), no consent (50), incomplete history (15),
    # missing allergy info (10). Expected: 40+45+50+15+10 = 160 -> critical band.
    record = _create_record(
        client,
        auth_headers,
        workflow.id,
        subject_dob="1985-05-05",
    )
    decision = _evaluate(client, auth_headers, record["id"])
    assert decision["risk_score"] == 40 + 45 + 50 + 15 + 10
    assert decision["risk_band"] == "critical"


def test_out_of_network_adds_risk_as_warning(client, auth_headers, db_session):
    _, workflow = _stage_ids(db_session)
    record = _create_record(
        client,
        auth_headers,
        workflow.id,
        identity_verified=True,
        insurance_status="verified",
        insurance_in_network=False,
        consent_status="signed",
        medical_history_status="complete",
        allergy_info_provided=True,
    )
    decision = _evaluate(client, auth_headers, record["id"])
    assert decision["can_progress"] is True
    warning_codes = [w["rule_code"] for w in decision["warnings"]]
    assert "out_of_network_warning" in warning_codes
    assert decision["risk_score"] == 20


# --------------------------------------------------------------------------
# persistence and evaluation history
# --------------------------------------------------------------------------


def test_evaluate_persists_rule_evaluations_and_replaces_previous_run(
    client, auth_headers, db_session
):
    _, workflow = _stage_ids(db_session)
    record = _create_record(client, auth_headers, workflow.id)

    # First run: record is missing identity -> identity_required should NOT pass.
    _evaluate(client, auth_headers, record["id"])
    first_rows = db_session.execute(
        select(RuleEvaluation).where(RuleEvaluation.record_id == record["id"])
    ).scalars().all()
    assert len(first_rows) == 7
    identity_first = next(r for r in first_rows if r.rule.code == "identity_required")
    assert identity_first.passed is False

    # Resolve identity and re-evaluate: the stored row for identity_required
    # should now reflect the new outcome (pass), proving the previous row was
    # replaced and not appended alongside.
    _patch_record(client, auth_headers, record["id"], identity_verified=True)
    _evaluate(client, auth_headers, record["id"])

    db_session.expire_all()
    second_rows = db_session.execute(
        select(RuleEvaluation).where(RuleEvaluation.record_id == record["id"])
    ).scalars().all()
    assert len(second_rows) == 7  # one per registered active rule, no accumulation
    identity_second = next(r for r in second_rows if r.rule.code == "identity_required")
    assert identity_second.passed is True


def test_evaluations_endpoint_returns_current_rows(client, auth_headers, db_session):
    _, workflow = _stage_ids(db_session)
    record = _create_record(client, auth_headers, workflow.id, identity_verified=True)
    _evaluate(client, auth_headers, record["id"])

    response = client.get(
        f"/api/records/{record['id']}/evaluations", headers=auth_headers
    )
    assert response.status_code == 200
    rows = response.json()
    assert len(rows) == 7
    assert all("action_applied" in row for row in rows)


def test_evaluation_updates_record_risk_fields(client, auth_headers, db_session):
    _, workflow = _stage_ids(db_session)
    record = _create_record(client, auth_headers, workflow.id)
    decision = _evaluate(client, auth_headers, record["id"])

    refetched = client.get(f"/api/records/{record['id']}", headers=auth_headers).json()
    assert refetched["risk_score"] == decision["risk_score"]
    assert refetched["risk_band"] == decision["risk_band"]


# --------------------------------------------------------------------------
# transitions
# --------------------------------------------------------------------------


def test_transition_fails_when_blocking_rules_present(
    client, auth_headers, db_session
):
    stages, workflow = _stage_ids(db_session)
    record = _create_record(client, auth_headers, workflow.id)
    target = stages["insurance_review"]

    response = client.post(
        f"/api/records/{record['id']}/transition",
        headers=auth_headers,
        json={"target_stage_id": target},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is False
    assert body["updated_stage_id"] == record["current_stage_id"]
    assert any(v["rule_code"] == "identity_required" for v in body["decision"]["violations"])


def test_transition_succeeds_when_only_warnings_present(
    client, auth_headers, db_session
):
    stages, workflow = _stage_ids(db_session)
    record = _create_record(
        client,
        auth_headers,
        workflow.id,
        identity_verified=True,
        insurance_status="verified",
        insurance_in_network=True,
        consent_status="signed",
        medical_history_status="incomplete",  # warning only
        allergy_info_provided=False,  # warning only
    )
    target = stages["provider_triage"]

    response = client.post(
        f"/api/records/{record['id']}/transition",
        headers=auth_headers,
        json={"target_stage_id": target},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["updated_stage_id"] == target
    assert body["decision"]["violations"] == []
    assert any(w["rule_code"] == "medical_history_warning" for w in body["decision"]["warnings"])


def test_transition_succeeds_when_all_requirements_met(
    client, auth_headers, db_session
):
    stages, workflow = _stage_ids(db_session)
    record = _create_record(
        client,
        auth_headers,
        workflow.id,
        identity_verified=True,
        insurance_status="verified",
        insurance_in_network=True,
        consent_status="signed",
        medical_history_status="complete",
        allergy_info_provided=True,
    )
    target = stages["ready_for_scheduling"]

    response = client.post(
        f"/api/records/{record['id']}/transition",
        headers=auth_headers,
        json={"target_stage_id": target},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["updated_stage_id"] == target
    assert body["decision"]["risk_score"] == 0
    assert body["decision"]["risk_band"] == "low"


def test_transition_rejects_stage_from_other_workflow(
    client, auth_headers, db_session
):
    _, workflow = _stage_ids(db_session)
    other = Workflow(
        organization_id=workflow.organization_id,
        name="Other",
        slug="other",
        description="Unrelated workflow",
    )
    db_session.add(other)
    db_session.flush()
    other_stage = WorkflowStage(
        workflow_id=other.id, name="Start", slug="start", order_index=0, is_terminal=False
    )
    db_session.add(other_stage)
    db_session.commit()

    record = _create_record(
        client,
        auth_headers,
        workflow.id,
        identity_verified=True,
        insurance_status="verified",
        insurance_in_network=True,
        consent_status="signed",
        medical_history_status="complete",
        allergy_info_provided=True,
    )
    response = client.post(
        f"/api/records/{record['id']}/transition",
        headers=auth_headers,
        json={"target_stage_id": other_stage.id},
    )
    assert response.status_code == 400


# --------------------------------------------------------------------------
# audit logging
# --------------------------------------------------------------------------


def test_transition_produces_audit_trail(client, auth_headers, db_session):
    stages, workflow = _stage_ids(db_session)
    record = _create_record(
        client,
        auth_headers,
        workflow.id,
        identity_verified=True,
        insurance_status="verified",
        insurance_in_network=True,
        consent_status="signed",
        medical_history_status="complete",
        allergy_info_provided=True,
    )
    target = stages["provider_triage"]
    client.post(
        f"/api/records/{record['id']}/transition",
        headers=auth_headers,
        json={"target_stage_id": target},
    )

    actions = [
        row.action
        for row in db_session.execute(
            select(AuditLog).where(AuditLog.record_id == record["id"]).order_by(AuditLog.id)
        ).scalars()
    ]
    assert "record.transition_attempted" in actions
    assert "record.evaluated" in actions
    assert "record.risk_recalculated" in actions
    assert "record.transition_completed" in actions


def test_blocked_transition_produces_blocked_audit_event(
    client, auth_headers, db_session
):
    stages, workflow = _stage_ids(db_session)
    record = _create_record(client, auth_headers, workflow.id)
    target = stages["insurance_review"]
    client.post(
        f"/api/records/{record['id']}/transition",
        headers=auth_headers,
        json={"target_stage_id": target},
    )

    actions = [
        row.action
        for row in db_session.execute(
            select(AuditLog).where(AuditLog.record_id == record["id"]).order_by(AuditLog.id)
        ).scalars()
    ]
    assert "record.transition_attempted" in actions
    assert "record.transition_blocked" in actions
    assert "record.transition_completed" not in actions


# --------------------------------------------------------------------------
# sanity: seeded rules align with registered evaluators
# --------------------------------------------------------------------------


def test_all_seeded_rules_have_registered_evaluators(db_session):
    from app.services import rule_engine_service

    codes_in_db = {
        row.code for row in db_session.execute(select(Rule)).scalars().all()
    }
    registered = set(rule_engine_service.registered_codes())
    assert codes_in_db == registered
    assert len(codes_in_db) == 7
