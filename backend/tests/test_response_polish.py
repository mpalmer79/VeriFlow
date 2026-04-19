"""Polish tests: record response carries assigned_user_name, and persisted
rule evaluations carry rule_code and rule_name.
"""

from sqlalchemy import select

from app.models.workflow import Workflow


def _workflow_id(db_session) -> int:
    workflow = db_session.execute(
        select(Workflow).where(Workflow.slug == "healthcare-intake")
    ).scalar_one()
    return workflow.id


def test_record_list_includes_assigned_user_name(client, auth_headers):
    response = client.get("/api/records", headers=auth_headers)
    assert response.status_code == 200
    rows = response.json()
    assigned_names = [row["assigned_user_name"] for row in rows if row["assigned_user_id"]]
    # The seed assigns the intake coordinator to every demo record.
    assert assigned_names
    assert all(name == "Jordan Patel" for name in assigned_names)


def test_record_get_includes_assigned_user_name(client, auth_headers):
    listing = client.get("/api/records", headers=auth_headers).json()
    record_id = listing[0]["id"]

    response = client.get(f"/api/records/{record_id}", headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert "assigned_user_name" in body
    if body["assigned_user_id"] is None:
        assert body["assigned_user_name"] is None
    else:
        assert isinstance(body["assigned_user_name"], str)
        assert body["assigned_user_name"]


def test_record_response_handles_null_assignee(client, auth_headers, db_session):
    workflow_id = _workflow_id(db_session)
    payload = {
        "workflow_id": workflow_id,
        "subject_full_name": "Unassigned Patient",
    }
    created = client.post("/api/records", json=payload, headers=auth_headers).json()
    assert created["assigned_user_id"] is None
    assert created["assigned_user_name"] is None

    fetched = client.get(f"/api/records/{created['id']}", headers=auth_headers).json()
    assert fetched["assigned_user_id"] is None
    assert fetched["assigned_user_name"] is None


def test_evaluations_endpoint_exposes_rule_code_and_name(client, auth_headers, db_session):
    # Pick a record that exercises every rule by moving it to a late stage.
    workflow_id = _workflow_id(db_session)
    from app.models.workflow import WorkflowStage

    target_stage = db_session.execute(
        select(WorkflowStage).where(
            WorkflowStage.workflow_id == workflow_id,
            WorkflowStage.slug == "clinical_history_review",
        )
    ).scalar_one()

    create = client.post(
        "/api/records",
        headers=auth_headers,
        json={
            "workflow_id": workflow_id,
            "subject_full_name": "Evaluation Subject",
            "subject_dob": "1990-01-01",
            "current_stage_id": target_stage.id,
        },
    ).json()
    record_id = create["id"]

    evaluate = client.post(f"/api/records/{record_id}/evaluate", headers=auth_headers)
    assert evaluate.status_code == 200

    rows = client.get(f"/api/records/{record_id}/evaluations", headers=auth_headers).json()
    assert rows, "evaluation endpoint should return the current evaluation rows"
    for row in rows:
        assert isinstance(row["rule_code"], str) and row["rule_code"]
        assert isinstance(row["rule_name"], str) and row["rule_name"]
        # No row should fall back to the old placeholder "rule#N" shape.
        assert not row["rule_code"].startswith("rule#")

    codes = {row["rule_code"] for row in rows}
    # Sanity: the seeded Healthcare Intake rules should all appear.
    expected = {
        "identity_required",
        "insurance_verified_or_self_pay",
        "consent_required",
        "guardian_authorization_required",
        "medical_history_warning",
        "allergy_warning",
        "out_of_network_warning",
    }
    assert expected.issubset(codes)
