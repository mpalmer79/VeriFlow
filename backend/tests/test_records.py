from sqlalchemy import select

from app.models.workflow import Workflow


def _workflow_id(db_session) -> int:
    workflow = db_session.execute(
        select(Workflow).where(Workflow.slug == "healthcare-intake")
    ).scalar_one()
    return workflow.id


def test_list_records_returns_seeded_data(client, auth_headers):
    response = client.get("/api/records", headers=auth_headers)
    assert response.status_code == 200
    items = response.json()
    assert len(items) >= 5
    references = {item["external_reference"] for item in items}
    assert "INT-1001" in references
    assert "INT-1005" in references


def test_list_records_requires_authentication(client):
    response = client.get("/api/records")
    assert response.status_code == 401


def test_create_record(client, auth_headers, db_session):
    workflow_id = _workflow_id(db_session)
    payload = {
        "workflow_id": workflow_id,
        "subject_full_name": "Test Patient",
        "subject_dob": "1990-05-15",
        "external_reference": "TEST-9001",
        "notes": "Created via test suite.",
    }
    response = client.post("/api/records", json=payload, headers=auth_headers)
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["subject_full_name"] == "Test Patient"
    assert body["status"] == "draft"
    assert body["workflow_id"] == workflow_id
    assert body["current_stage_id"] is not None


def test_create_record_with_unknown_workflow_returns_404(client, auth_headers):
    payload = {
        "workflow_id": 9999,
        "subject_full_name": "No Workflow",
    }
    response = client.post("/api/records", json=payload, headers=auth_headers)
    assert response.status_code == 404


def test_get_record_by_id(client, auth_headers):
    listing = client.get("/api/records", headers=auth_headers).json()
    record_id = listing[0]["id"]

    response = client.get(f"/api/records/{record_id}", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["id"] == record_id


def test_get_record_not_found(client, auth_headers):
    response = client.get("/api/records/999999", headers=auth_headers)
    assert response.status_code == 404


def test_update_record_changes_notes(client, auth_headers):
    listing = client.get("/api/records", headers=auth_headers).json()
    record_id = listing[0]["id"]

    response = client.patch(
        f"/api/records/{record_id}",
        json={"notes": "Updated by test."},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["notes"] == "Updated by test."
