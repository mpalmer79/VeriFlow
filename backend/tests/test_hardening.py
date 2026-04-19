"""Hardening tests: DocumentRequirement uniqueness and document-status
semantics.

These cover invariants that would silently break in PostgreSQL without
the partial-unique-index fix and the semantic partition of the document
status endpoint.
"""

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.models.document_requirement import DocumentRequirement
from app.models.enums import DocumentType
from app.models.workflow import Workflow, WorkflowStage


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


def _create_record(client, auth_headers, workflow_id, *, stage_slug, **overrides):
    payload = {
        "workflow_id": workflow_id,
        "subject_full_name": overrides.pop("subject_full_name", "Hardening Subject"),
        "subject_dob": "1990-01-01",
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
    payload = {
        k: v for k, v in payload.items() if v is not None or k == "insurance_in_network"
    }
    response = client.post("/api/records", json=payload, headers=auth_headers)
    assert response.status_code == 201, response.text
    record = response.json()

    target = _app_stage_ids()[stage_slug]
    if record["current_stage_id"] != target:
        patch = client.patch(
            f"/api/records/{record['id']}",
            json={"current_stage_id": target},
            headers=auth_headers,
        )
        assert patch.status_code == 200, patch.text
        record = patch.json()
    return record


def _upload(client, auth_headers, record_id, document_type, **extras):
    body = {"document_type": document_type, **extras}
    response = client.post(
        f"/api/records/{record_id}/documents", headers=auth_headers, json=body
    )
    assert response.status_code == 201, response.text
    return response.json()


def _verify(client, auth_headers, document_id):
    response = client.post(
        f"/api/documents/{document_id}/verify", headers=auth_headers, json={}
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


# --------------------------------------------------------------------------
# DocumentRequirement uniqueness with nullable stage_id
# --------------------------------------------------------------------------


def test_duplicate_global_document_requirement_is_rejected(db_session):
    """Two workflow-global requirements for the same (workflow, document_type)
    must not coexist. The partial unique index on `stage_id IS NULL` enforces
    this at the database layer."""
    workflow = _workflow(db_session)
    db_session.add(
        DocumentRequirement(
            workflow_id=workflow.id,
            stage_id=None,
            document_type=DocumentType.OTHER,
            is_required=True,
        )
    )
    db_session.commit()

    db_session.add(
        DocumentRequirement(
            workflow_id=workflow.id,
            stage_id=None,
            document_type=DocumentType.OTHER,
            is_required=True,
        )
    )
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_duplicate_stage_specific_requirement_is_rejected(db_session):
    """Two requirements for the same (workflow, stage, document_type) must
    not coexist. The seed already inserts most stage-scoped requirements,
    so this test picks a pair that is not in the seed and ensures the
    constraint rejects a duplicate on top of it."""
    stages, workflow = _stages(db_session)
    stage_id = stages["provider_triage"]

    db_session.add(
        DocumentRequirement(
            workflow_id=workflow.id,
            stage_id=stage_id,
            document_type=DocumentType.OTHER,
            is_required=True,
        )
    )
    db_session.commit()

    db_session.add(
        DocumentRequirement(
            workflow_id=workflow.id,
            stage_id=stage_id,
            document_type=DocumentType.OTHER,
            is_required=True,
        )
    )
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_global_and_stage_specific_requirement_can_coexist(db_session):
    """A workflow-global requirement and a stage-specific requirement of the
    same document type are legitimately different rows. Neither partial
    index should reject the combination."""
    stages, workflow = _stages(db_session)
    stage_id = stages["closed"]

    db_session.add(
        DocumentRequirement(
            workflow_id=workflow.id,
            stage_id=None,
            document_type=DocumentType.OTHER,
            is_required=True,
        )
    )
    db_session.add(
        DocumentRequirement(
            workflow_id=workflow.id,
            stage_id=stage_id,
            document_type=DocumentType.OTHER,
            is_required=True,
        )
    )
    db_session.commit()

    rows = db_session.execute(
        select(DocumentRequirement).where(
            DocumentRequirement.workflow_id == workflow.id,
            DocumentRequirement.document_type == DocumentType.OTHER,
        )
    ).scalars().all()
    assert len(rows) == 2
    scopes = {row.stage_id for row in rows}
    assert scopes == {None, stage_id}


def test_different_stages_same_document_type_are_allowed(db_session):
    """Same document type, two different stages in the same workflow: legal."""
    stages, workflow = _stages(db_session)
    db_session.add(
        DocumentRequirement(
            workflow_id=workflow.id,
            stage_id=stages["provider_triage"],
            document_type=DocumentType.OTHER,
            is_required=True,
        )
    )
    db_session.add(
        DocumentRequirement(
            workflow_id=workflow.id,
            stage_id=stages["closed"],
            document_type=DocumentType.OTHER,
            is_required=True,
        )
    )
    db_session.commit()  # should not raise


# --------------------------------------------------------------------------
# document-status semantics
# --------------------------------------------------------------------------


def test_verified_document_satisfies_requirement(client, auth_headers, db_session):
    _, workflow = _stages(db_session)
    record = _create_record(
        client, auth_headers, workflow.id, stage_slug="identity_verification"
    )
    doc = _upload(client, auth_headers, record["id"], "photo_id")
    _verify(client, auth_headers, doc["id"])

    body = client.get(
        f"/api/records/{record['id']}/document-status", headers=auth_headers
    ).json()
    assert "photo_id" in body["required_types"]
    assert "photo_id" in body["satisfied_types"]
    assert "photo_id" in body["verified_types"]
    assert "photo_id" in body["present_types"]
    assert "photo_id" not in body["missing_types"]
    assert "photo_id" not in body["rejected_types"]


def test_uploaded_but_unverified_document_does_not_satisfy_requirement(
    client, auth_headers, db_session
):
    _, workflow = _stages(db_session)
    record = _create_record(
        client, auth_headers, workflow.id, stage_slug="identity_verification"
    )
    _upload(client, auth_headers, record["id"], "photo_id")  # uploaded, not verified

    body = client.get(
        f"/api/records/{record['id']}/document-status", headers=auth_headers
    ).json()
    assert "photo_id" in body["required_types"]
    assert "photo_id" in body["present_types"]
    assert "photo_id" not in body["verified_types"]
    assert "photo_id" not in body["satisfied_types"]
    assert "photo_id" in body["missing_types"]


def test_rejected_required_document_does_not_satisfy_requirement(
    client, auth_headers, db_session
):
    _, workflow = _stages(db_session)
    record = _create_record(
        client, auth_headers, workflow.id, stage_slug="identity_verification"
    )
    doc = _upload(client, auth_headers, record["id"], "photo_id")
    _reject(client, auth_headers, doc["id"], reason="blurry")

    body = client.get(
        f"/api/records/{record['id']}/document-status", headers=auth_headers
    ).json()
    assert "photo_id" in body["required_types"]
    assert "photo_id" in body["missing_types"]
    assert "photo_id" in body["rejected_types"]
    assert "photo_id" not in body["verified_types"]
    assert "photo_id" not in body["satisfied_types"]
    assert "photo_id" not in body["present_types"]


def test_verified_and_rejected_same_type_shows_both_signals(
    client, auth_headers, db_session
):
    """A record with a rejected document and a later verified document of
    the same type satisfies the requirement. The rejected document remains
    visible historically in `rejected_types`."""
    _, workflow = _stages(db_session)
    record = _create_record(
        client, auth_headers, workflow.id, stage_slug="identity_verification"
    )

    rejected = _upload(client, auth_headers, record["id"], "photo_id")
    _reject(client, auth_headers, rejected["id"], reason="resubmission requested")

    verified = _upload(client, auth_headers, record["id"], "photo_id")
    _verify(client, auth_headers, verified["id"])

    body = client.get(
        f"/api/records/{record['id']}/document-status", headers=auth_headers
    ).json()
    assert "photo_id" in body["satisfied_types"]
    assert "photo_id" in body["verified_types"]
    assert "photo_id" in body["rejected_types"]
    assert "photo_id" in body["present_types"]
    assert "photo_id" not in body["missing_types"]


def test_required_is_partition_of_satisfied_and_missing(
    client, auth_headers, db_session
):
    """Invariant: required_types = satisfied_types ∪ missing_types, with
    no overlap. This is the key property callers rely on when summarizing
    a record's document readiness."""
    _, workflow = _stages(db_session)
    record = _create_record(
        client, auth_headers, workflow.id, stage_slug="clinical_history_review"
    )

    photo = _upload(client, auth_headers, record["id"], "photo_id")
    _verify(client, auth_headers, photo["id"])
    _upload(client, auth_headers, record["id"], "insurance_card")  # present, unverified
    rejected = _upload(client, auth_headers, record["id"], "consent_form")
    _reject(client, auth_headers, rejected["id"], reason="incomplete")
    # medical_history_form intentionally absent

    body = client.get(
        f"/api/records/{record['id']}/document-status", headers=auth_headers
    ).json()
    required = set(body["required_types"])
    satisfied = set(body["satisfied_types"])
    missing = set(body["missing_types"])

    assert required == satisfied | missing
    assert satisfied.isdisjoint(missing)
    assert satisfied == {"photo_id"}
    assert missing == required - {"photo_id"}


def test_document_status_consistency_across_verify_reject_cycles(
    client, auth_headers, db_session
):
    """Verify → reject → reverify should leave the record in the expected
    state at each step without leaking stale membership."""
    _, workflow = _stages(db_session)
    record = _create_record(
        client, auth_headers, workflow.id, stage_slug="identity_verification"
    )
    doc = _upload(client, auth_headers, record["id"], "photo_id")

    _verify(client, auth_headers, doc["id"])
    step1 = client.get(
        f"/api/records/{record['id']}/document-status", headers=auth_headers
    ).json()
    assert "photo_id" in step1["satisfied_types"]
    assert "photo_id" not in step1["missing_types"]

    _reject(client, auth_headers, doc["id"], reason="re-review")
    step2 = client.get(
        f"/api/records/{record['id']}/document-status", headers=auth_headers
    ).json()
    assert "photo_id" in step2["missing_types"]
    assert "photo_id" not in step2["satisfied_types"]
    assert "photo_id" not in step2["verified_types"]
    assert "photo_id" in step2["rejected_types"]

    _verify(client, auth_headers, doc["id"])
    step3 = client.get(
        f"/api/records/{record['id']}/document-status", headers=auth_headers
    ).json()
    assert "photo_id" in step3["satisfied_types"]
    assert "photo_id" not in step3["missing_types"]
    assert "photo_id" in step3["verified_types"]
    # verify clears rejection fields on the row, so rejected_types clears too
    assert "photo_id" not in step3["rejected_types"]
