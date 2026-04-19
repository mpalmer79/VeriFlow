"""End-to-end tests for Phase 3: document evidence, required documents,
document-aware rules, and stage-aware rule filtering.
"""

from datetime import date, timedelta

from sqlalchemy import select

from app.models.audit import AuditLog
from app.models.workflow import Workflow, WorkflowStage


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------


def _workflow(db_session) -> Workflow:
    return db_session.execute(
        select(Workflow).where(Workflow.slug == "healthcare-intake")
    ).scalar_one()


def _stages(db_session):
    workflow = _workflow(db_session)
    stages = db_session.execute(
        select(WorkflowStage)
        .where(WorkflowStage.workflow_id == workflow.id)
        .order_by(WorkflowStage.order_index)
    ).scalars().all()
    return {stage.slug: stage.id for stage in stages}, workflow


def _app_stage_ids():
    from app.core import database as db_module

    with db_module.SessionLocal() as db:
        return _stages(db)[0]


def _create_record(
    client,
    auth_headers,
    workflow_id,
    *,
    stage_slug="clinical_history_review",
    **overrides,
):
    payload = {
        "workflow_id": workflow_id,
        "subject_full_name": overrides.pop("subject_full_name", "Test Subject"),
        "subject_dob": overrides.pop("subject_dob", "1990-01-01"),
        "insurance_status": overrides.pop("insurance_status", "unknown"),
        "consent_status": overrides.pop("consent_status", "not_provided"),
        "medical_history_status": overrides.pop("medical_history_status", "not_started"),
        "identity_verified": overrides.pop("identity_verified", False),
        "guardian_authorization_signed": overrides.pop(
            "guardian_authorization_signed", False
        ),
        "allergy_info_provided": overrides.pop("allergy_info_provided", False),
        "insurance_in_network": overrides.pop("insurance_in_network", None),
    }
    payload.update(overrides)
    payload = {k: v for k, v in payload.items() if v is not None or k == "insurance_in_network"}
    response = client.post("/api/records", json=payload, headers=auth_headers)
    assert response.status_code == 201, response.text
    record = response.json()

    stage_ids = _app_stage_ids()
    target = stage_ids[stage_slug]
    if record["current_stage_id"] != target:
        patch = client.patch(
            f"/api/records/{record['id']}",
            json={
                "current_stage_id": target,
                "expected_version": record["version"],
            },
            headers=auth_headers,
        )
        assert patch.status_code == 200, patch.text
        record = patch.json()
    return record


def _current_version(client, auth_headers, record_id: int) -> int:
    body = client.get(f"/api/records/{record_id}", headers=auth_headers).json()
    return int(body["version"])


def _upload(client, auth_headers, record_id, document_type, **extras):
    body = {"document_type": document_type, **extras}
    response = client.post(
        f"/api/records/{record_id}/documents", headers=auth_headers, json=body
    )
    assert response.status_code == 201, response.text
    return response.json()


def _verify(client, auth_headers, document_id, notes=None):
    body = {"notes": notes} if notes is not None else {}
    response = client.post(
        f"/api/documents/{document_id}/verify", headers=auth_headers, json=body
    )
    assert response.status_code == 200, response.text
    return response.json()


def _reject(client, auth_headers, document_id, reason=None):
    body = {"reason": reason} if reason is not None else {}
    response = client.post(
        f"/api/documents/{document_id}/reject", headers=auth_headers, json=body
    )
    assert response.status_code == 200, response.text
    return response.json()


def _evaluate(client, auth_headers, record_id):
    response = client.post(f"/api/records/{record_id}/evaluate", headers=auth_headers)
    assert response.status_code == 200, response.text
    return response.json()


# --------------------------------------------------------------------------
# document-aware rules
# --------------------------------------------------------------------------


def test_identity_rule_passes_when_verified_photo_id_exists(
    client, auth_headers, db_session
):
    _, workflow = _stages(db_session)
    # identity_verified=False by default; identity must come from document.
    record = _create_record(client, auth_headers, workflow.id)
    doc = _upload(client, auth_headers, record["id"], "photo_id")
    _verify(client, auth_headers, doc["id"])

    decision = _evaluate(client, auth_headers, record["id"])
    violation_codes = [v["rule_code"] for v in decision["violations"]]
    assert "identity_required" not in violation_codes


def test_identity_rule_blocks_when_photo_id_missing_and_flag_false(
    client, auth_headers, db_session
):
    _, workflow = _stages(db_session)
    record = _create_record(client, auth_headers, workflow.id)
    decision = _evaluate(client, auth_headers, record["id"])
    violation_codes = [v["rule_code"] for v in decision["violations"]]
    assert "identity_required" in violation_codes


def test_identity_rule_blocks_when_photo_id_rejected(client, auth_headers, db_session):
    _, workflow = _stages(db_session)
    record = _create_record(client, auth_headers, workflow.id)
    doc = _upload(client, auth_headers, record["id"], "photo_id")
    _reject(client, auth_headers, doc["id"], reason="illegible")
    decision = _evaluate(client, auth_headers, record["id"])
    violation_codes = [v["rule_code"] for v in decision["violations"]]
    assert "identity_required" in violation_codes


def test_consent_rule_passes_when_consent_form_verified(
    client, auth_headers, db_session
):
    _, workflow = _stages(db_session)
    record = _create_record(
        client,
        auth_headers,
        workflow.id,
        identity_verified=True,
        insurance_status="verified",
        insurance_in_network=True,
    )
    doc = _upload(client, auth_headers, record["id"], "consent_form")
    _verify(client, auth_headers, doc["id"])

    decision = _evaluate(client, auth_headers, record["id"])
    violation_codes = [v["rule_code"] for v in decision["violations"]]
    assert "consent_required" not in violation_codes


def test_guardian_rule_blocks_minor_without_verified_authorization(
    client, auth_headers, db_session
):
    _, workflow = _stages(db_session)
    dob = (date.today() - timedelta(days=365 * 10)).isoformat()
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

    doc = _upload(client, auth_headers, record["id"], "guardian_authorization")
    _verify(client, auth_headers, doc["id"])
    decision_after = _evaluate(client, auth_headers, record["id"])
    violation_codes_after = [v["rule_code"] for v in decision_after["violations"]]
    assert "guardian_authorization_required" not in violation_codes_after


def test_guardian_rule_passes_for_adult_without_document(
    client, auth_headers, db_session
):
    _, workflow = _stages(db_session)
    record = _create_record(
        client,
        auth_headers,
        workflow.id,
        subject_dob="1980-01-01",
        identity_verified=True,
        insurance_status="verified",
        insurance_in_network=True,
        consent_status="signed",
    )
    decision = _evaluate(client, auth_headers, record["id"])
    violation_codes = [v["rule_code"] for v in decision["violations"]]
    assert "guardian_authorization_required" not in violation_codes


def test_verifying_required_document_unblocks_progression(
    client, auth_headers, db_session
):
    stages, workflow = _stages(db_session)
    # All non-document signals are satisfied; only identity document is needed.
    record = _create_record(
        client,
        auth_headers,
        workflow.id,
        insurance_status="verified",
        insurance_in_network=True,
        consent_status="signed",
        medical_history_status="complete",
        allergy_info_provided=True,
    )
    # Without the photo_id document and identity_verified=False, identity blocks.
    blocked = client.post(
        f"/api/records/{record['id']}/transition",
        headers=auth_headers,
        json={"target_stage_id": stages["provider_triage"], "expected_version": _current_version(client, auth_headers, record["id"])},
    ).json()
    assert blocked["success"] is False
    assert any(
        v["rule_code"] == "identity_required" for v in blocked["decision"]["violations"]
    )

    doc = _upload(client, auth_headers, record["id"], "photo_id")
    _verify(client, auth_headers, doc["id"])

    ok = client.post(
        f"/api/records/{record['id']}/transition",
        headers=auth_headers,
        json={"target_stage_id": stages["provider_triage"], "expected_version": _current_version(client, auth_headers, record["id"])},
    ).json()
    assert ok["success"] is True
    assert ok["updated_stage_id"] == stages["provider_triage"]


def test_rejecting_a_verified_required_document_reblocks(client, auth_headers, db_session):
    _, workflow = _stages(db_session)
    record = _create_record(
        client,
        auth_headers,
        workflow.id,
        insurance_status="verified",
        insurance_in_network=True,
        consent_status="signed",
    )
    doc = _upload(client, auth_headers, record["id"], "photo_id")
    _verify(client, auth_headers, doc["id"])

    before = _evaluate(client, auth_headers, record["id"])
    assert all(v["rule_code"] != "identity_required" for v in before["violations"])

    _reject(client, auth_headers, doc["id"], reason="photo does not match subject")

    after = _evaluate(client, auth_headers, record["id"])
    violation_codes = [v["rule_code"] for v in after["violations"]]
    assert "identity_required" in violation_codes


# --------------------------------------------------------------------------
# stage-aware evaluation
# --------------------------------------------------------------------------


def test_evaluation_at_early_stage_skips_later_stage_rules(
    client, auth_headers, db_session
):
    _, workflow = _stages(db_session)
    # Record at New Intake: no rules are stage-gated to new_intake, so nothing fires.
    record = _create_record(
        client, auth_headers, workflow.id, stage_slug="new_intake"
    )
    decision = _evaluate(client, auth_headers, record["id"])
    assert decision["violations"] == []
    assert decision["warnings"] == []
    assert decision["risk_score"] == 0


def test_transition_uses_target_stage_context_not_current(
    client, auth_headers, db_session
):
    stages, workflow = _stages(db_session)
    # Record sits at New Intake with nothing satisfied.
    record = _create_record(
        client, auth_headers, workflow.id, stage_slug="new_intake"
    )

    # Evaluating in place (current = new_intake) exposes no rules.
    in_place = _evaluate(client, auth_headers, record["id"])
    assert in_place["violations"] == []

    # Attempting a transition to Insurance Review pulls in identity_required
    # and insurance_verified_or_self_pay, which must fail.
    response = client.post(
        f"/api/records/{record['id']}/transition",
        headers=auth_headers,
        json={"target_stage_id": stages["insurance_review"], "expected_version": _current_version(client, auth_headers, record["id"])},
    )
    body = response.json()
    assert response.status_code == 200
    assert body["success"] is False
    codes = {v["rule_code"] for v in body["decision"]["violations"]}
    assert "identity_required" in codes
    assert "insurance_verified_or_self_pay" in codes


# --------------------------------------------------------------------------
# document-status endpoint
# --------------------------------------------------------------------------


def test_document_status_reports_missing_present_verified_rejected(
    client, auth_headers, db_session
):
    _, workflow = _stages(db_session)
    record = _create_record(client, auth_headers, workflow.id)

    photo = _upload(client, auth_headers, record["id"], "photo_id")
    _verify(client, auth_headers, photo["id"])

    insurance = _upload(client, auth_headers, record["id"], "insurance_card")
    _reject(client, auth_headers, insurance["id"], reason="expired")

    consent = _upload(client, auth_headers, record["id"], "consent_form")
    # consent stays UPLOADED (present but not verified)

    response = client.get(
        f"/api/records/{record['id']}/document-status", headers=auth_headers
    )
    assert response.status_code == 200
    body = response.json()

    required = set(body["required_types"])
    assert "photo_id" in required
    assert "insurance_card" in required
    assert "consent_form" in required
    assert "medical_history_form" in required

    assert "photo_id" in body["verified_types"]
    assert "photo_id" in body["present_types"]
    assert "consent_form" in body["present_types"]
    assert "consent_form" not in body["verified_types"]
    assert "insurance_card" in body["rejected_types"]
    assert "insurance_card" in body["missing_types"]  # only rejected => missing
    assert "medical_history_form" in body["missing_types"]


# --------------------------------------------------------------------------
# audit trail for document events
# --------------------------------------------------------------------------


def test_document_events_write_structured_audit_payloads(
    client, auth_headers, db_session
):
    _, workflow = _stages(db_session)
    record = _create_record(client, auth_headers, workflow.id)

    uploaded = _upload(
        client,
        auth_headers,
        record["id"],
        "photo_id",
        label="Driver's license",
    )
    _verify(client, auth_headers, uploaded["id"], notes="looks good")

    rejected = _upload(
        client,
        auth_headers,
        record["id"],
        "insurance_card",
    )
    _reject(client, auth_headers, rejected["id"], reason="coverage terminated")

    rows = db_session.execute(
        select(AuditLog).where(AuditLog.record_id == record["id"]).order_by(AuditLog.id)
    ).scalars().all()
    actions = [row.action for row in rows]
    assert actions.count("document.uploaded") == 2
    assert actions.count("document.verified") == 1
    assert actions.count("document.rejected") == 1

    verify_row = next(r for r in rows if r.action == "document.verified")
    assert verify_row.payload["record_id"] == record["id"]
    assert verify_row.payload["document_type"] == "photo_id"
    assert verify_row.payload["document_status"] == "verified"
    assert verify_row.payload["verified_by"] is not None

    reject_row = next(r for r in rows if r.action == "document.rejected")
    assert reject_row.payload["document_type"] == "insurance_card"
    assert reject_row.payload["document_status"] == "rejected"
    assert reject_row.payload["rejection_reason"] == "coverage terminated"


def test_evaluated_audit_payload_uses_canonical_keys(client, auth_headers, db_session):
    _, workflow = _stages(db_session)
    record = _create_record(client, auth_headers, workflow.id)
    _evaluate(client, auth_headers, record["id"])

    row = db_session.execute(
        select(AuditLog)
        .where(AuditLog.record_id == record["id"], AuditLog.action == "record.evaluated")
        .order_by(AuditLog.id.desc())
    ).scalars().first()
    assert row is not None
    for key in (
        "record_id",
        "current_stage_id",
        "stage_context_id",
        "rules_evaluated",
        "blocking_rule_codes",
        "warning_rule_codes",
        "risk_score",
        "risk_band",
    ):
        assert key in row.payload, f"missing key {key} in record.evaluated payload"


# --------------------------------------------------------------------------
# cross-record isolation
# --------------------------------------------------------------------------


def test_cannot_verify_document_from_another_organization(
    client, auth_headers, db_session
):
    _, workflow = _stages(db_session)
    record = _create_record(client, auth_headers, workflow.id)
    doc = _upload(client, auth_headers, record["id"], "photo_id")

    # Point the document at a foreign organization to simulate a leak.
    from app.models.document import Document
    from app.models.organization import Organization

    other_org = Organization(name="Other Org", slug="other-org")
    db_session.add(other_org)
    db_session.flush()

    doc_row = db_session.get(Document, doc["id"])
    doc_row.record.organization_id = other_org.id
    db_session.commit()

    response = client.post(f"/api/documents/{doc['id']}/verify", headers=auth_headers)
    assert response.status_code == 403
