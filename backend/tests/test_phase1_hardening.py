"""Phase 1 hardening tests.

Covers:
- record optimistic concurrency (version + expected_version + 409 conflict)
- transition optimistic concurrency
- audit chain linking (previous_hash / entry_hash)
- JWT claim issuance and validation (iss / aud / typ / jti / nbf)
- document integrity metadata persistence
"""

from datetime import timedelta, timezone

import pytest
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


def _stage_id(db_session, slug: str) -> int:
    workflow = _workflow(db_session)
    return db_session.execute(
        select(WorkflowStage).where(
            WorkflowStage.workflow_id == workflow.id,
            WorkflowStage.slug == slug,
        )
    ).scalar_one().id


def _create_record(client, auth_headers, workflow_id, **overrides):
    payload = {
        "workflow_id": workflow_id,
        "subject_full_name": overrides.pop("subject_full_name", "Phase 1 Subject"),
        "subject_dob": overrides.pop("subject_dob", "1990-01-01"),
    }
    payload.update(overrides)
    response = client.post("/api/records", json=payload, headers=auth_headers)
    assert response.status_code == 201, response.text
    return response.json()


# --------------------------------------------------------------------------
# A. record optimistic concurrency
# --------------------------------------------------------------------------


def test_record_read_exposes_version(client, auth_headers, db_session):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    assert record["version"] == 1

    fetched = client.get(f"/api/records/{record['id']}", headers=auth_headers).json()
    assert fetched["version"] == 1


def test_record_update_requires_expected_version(client, auth_headers, db_session):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    response = client.patch(
        f"/api/records/{record['id']}",
        headers=auth_headers,
        json={"notes": "No version"},
    )
    assert response.status_code == 422


def test_record_update_succeeds_and_increments_version(
    client, auth_headers, db_session
):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    response = client.patch(
        f"/api/records/{record['id']}",
        headers=auth_headers,
        json={"notes": "first edit", "expected_version": record["version"]},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["notes"] == "first edit"
    assert body["version"] == record["version"] + 1


def test_record_update_with_stale_version_returns_conflict(
    client, auth_headers, db_session
):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    # First edit advances the version.
    client.patch(
        f"/api/records/{record['id']}",
        headers=auth_headers,
        json={"notes": "advance", "expected_version": record["version"]},
    )
    # Second edit using the original (now stale) expected_version must conflict.
    response = client.patch(
        f"/api/records/{record['id']}",
        headers=auth_headers,
        json={"notes": "stale", "expected_version": record["version"]},
    )
    assert response.status_code == 409


# --------------------------------------------------------------------------
# B. transition optimistic concurrency
# --------------------------------------------------------------------------


def test_transition_with_stale_version_returns_conflict(
    client, auth_headers, db_session
):
    record = _create_record(
        client,
        auth_headers,
        _workflow(db_session).id,
        identity_verified=True,
        insurance_status="verified",
        insurance_in_network=True,
        consent_status="signed",
        medical_history_status="complete",
        allergy_info_provided=True,
    )
    target = _stage_id(db_session, "provider_triage")
    # Bump version with an unrelated edit.
    client.patch(
        f"/api/records/{record['id']}",
        headers=auth_headers,
        json={"notes": "bump", "expected_version": record["version"]},
    )
    # Transition with the original stale version.
    response = client.post(
        f"/api/records/{record['id']}/transition",
        headers=auth_headers,
        json={"target_stage_id": target, "expected_version": record["version"]},
    )
    assert response.status_code == 409


def test_successful_transition_increments_version(client, auth_headers, db_session):
    record = _create_record(
        client,
        auth_headers,
        _workflow(db_session).id,
        identity_verified=True,
        insurance_status="verified",
        insurance_in_network=True,
        consent_status="signed",
        medical_history_status="complete",
        allergy_info_provided=True,
    )
    target = _stage_id(db_session, "provider_triage")
    response = client.post(
        f"/api/records/{record['id']}/transition",
        headers=auth_headers,
        json={"target_stage_id": target, "expected_version": record["version"]},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["record_version"] == record["version"] + 1

    refetched = client.get(f"/api/records/{record['id']}", headers=auth_headers).json()
    assert refetched["version"] == body["record_version"]


def test_blocked_transition_does_not_increment_version(
    client, auth_headers, db_session
):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    target = _stage_id(db_session, "provider_triage")
    response = client.post(
        f"/api/records/{record['id']}/transition",
        headers=auth_headers,
        json={"target_stage_id": target, "expected_version": record["version"]},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is False
    assert body["record_version"] == record["version"]

    refetched = client.get(f"/api/records/{record['id']}", headers=auth_headers).json()
    assert refetched["version"] == record["version"]


# --------------------------------------------------------------------------
# C. audit chain
# --------------------------------------------------------------------------


def test_audit_chain_links_successive_events(client, auth_headers, db_session):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    client.patch(
        f"/api/records/{record['id']}",
        headers=auth_headers,
        json={"notes": "edit 1", "expected_version": record["version"]},
    )
    # Fetch the current version again for the second edit.
    current = client.get(
        f"/api/records/{record['id']}", headers=auth_headers
    ).json()
    client.patch(
        f"/api/records/{record['id']}",
        headers=auth_headers,
        json={"notes": "edit 2", "expected_version": current["version"]},
    )

    rows = db_session.execute(
        select(AuditLog)
        .where(AuditLog.record_id == record["id"])
        .order_by(AuditLog.id.asc())
    ).scalars().all()
    assert len(rows) >= 3  # record.created + two record.updated

    # Genesis event in scope may or may not have a previous_hash, but every
    # subsequent event must point at the prior event's entry_hash.
    # Chain is organization-scoped, so fetch all events for the org in order.
    organization_id = rows[0].organization_id
    org_rows = db_session.execute(
        select(AuditLog)
        .where(AuditLog.organization_id == organization_id)
        .order_by(AuditLog.id.asc())
    ).scalars().all()
    hashes = [r.entry_hash for r in org_rows]
    assert all(h and len(h) == 64 for h in hashes)
    for idx in range(1, len(org_rows)):
        assert org_rows[idx].previous_hash == org_rows[idx - 1].entry_hash


def test_audit_hash_changes_when_payload_changes(client, auth_headers, db_session):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    current = record
    for notes in ("a", "b", "c"):
        patched = client.patch(
            f"/api/records/{current['id']}",
            headers=auth_headers,
            json={"notes": notes, "expected_version": current["version"]},
        ).json()
        current = patched

    rows = db_session.execute(
        select(AuditLog)
        .where(AuditLog.record_id == record["id"], AuditLog.action == "record.updated")
        .order_by(AuditLog.id.asc())
    ).scalars().all()
    assert len(rows) == 3
    # Distinct payloads should yield distinct entry hashes.
    assert len({row.entry_hash for row in rows}) == 3


# --------------------------------------------------------------------------
# D. JWT claim issuance and validation
# --------------------------------------------------------------------------


def test_create_token_includes_required_claims(client):
    from app.core.security import ACCESS_TOKEN_TYPE, create_access_token, decode_access_token

    token = create_access_token(subject="42", extra_claims={"role": "reviewer"})
    claims = decode_access_token(token)
    for required in ("sub", "iat", "nbf", "exp", "iss", "aud", "typ", "jti"):
        assert required in claims, f"missing claim {required}"
    assert claims["sub"] == "42"
    assert claims["typ"] == ACCESS_TOKEN_TYPE
    assert claims["role"] == "reviewer"
    assert isinstance(claims["jti"], str) and len(claims["jti"]) >= 16


def test_decode_rejects_wrong_audience():
    from jose import jwt

    from app.core.config import get_settings
    from app.core.security import TokenValidationError, decode_access_token

    settings = get_settings()
    now = 1_700_000_000
    token = jwt.encode(
        {
            "sub": "1",
            "iat": now,
            "nbf": now,
            "exp": now + 10_000,
            "iss": settings.jwt_issuer,
            "aud": "some-other-audience",
            "typ": "access",
            "jti": "x",
        },
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )
    with pytest.raises(TokenValidationError):
        decode_access_token(token)


def test_decode_rejects_wrong_issuer():
    from jose import jwt

    from app.core.config import get_settings
    from app.core.security import TokenValidationError, decode_access_token

    settings = get_settings()
    now = 1_700_000_000
    token = jwt.encode(
        {
            "sub": "1",
            "iat": now,
            "nbf": now,
            "exp": now + 10_000,
            "iss": "not-veriflow",
            "aud": settings.jwt_audience,
            "typ": "access",
            "jti": "x",
        },
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )
    with pytest.raises(TokenValidationError):
        decode_access_token(token)


def test_decode_rejects_wrong_token_type():
    from jose import jwt

    from app.core.config import get_settings
    from app.core.security import TokenValidationError, decode_access_token

    settings = get_settings()
    now = 1_700_000_000
    token = jwt.encode(
        {
            "sub": "1",
            "iat": now,
            "nbf": now,
            "exp": now + 10_000,
            "iss": settings.jwt_issuer,
            "aud": settings.jwt_audience,
            "typ": "refresh",
            "jti": "x",
        },
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )
    with pytest.raises(TokenValidationError):
        decode_access_token(token)


def test_me_endpoint_rejects_foreign_audience_token(client):
    from jose import jwt

    from app.core.config import get_settings

    settings = get_settings()
    now = 1_700_000_000
    token = jwt.encode(
        {
            "sub": "1",
            "iat": now,
            "nbf": now,
            "exp": now + 10_000,
            "iss": settings.jwt_issuer,
            "aud": "foreign-app",
            "typ": "access",
            "jti": "x",
        },
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )
    response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401


# --------------------------------------------------------------------------
# E. document integrity metadata
# --------------------------------------------------------------------------


def test_document_metadata_persists_and_serializes(
    client, auth_headers, db_session
):
    from datetime import datetime

    record = _create_record(client, auth_headers, _workflow(db_session).id)
    expires_at = (
        datetime.now(timezone.utc) + timedelta(days=30)
    ).isoformat()
    response = client.post(
        f"/api/records/{record['id']}/documents",
        headers=auth_headers,
        json={
            "document_type": "photo_id",
            "label": "Driver's license scan",
            "original_filename": "license.png",
            "mime_type": "image/png",
            "size_bytes": 128_000,
            "content_hash": "a" * 64,
            "expires_at": expires_at,
        },
    )
    assert response.status_code == 201, response.text
    doc = response.json()
    assert doc["original_filename"] == "license.png"
    assert doc["mime_type"] == "image/png"
    assert doc["size_bytes"] == 128_000
    assert doc["content_hash"] == "a" * 64
    assert doc["verified_content_hash"] is None
    assert doc["expires_at"] is not None


def test_verification_records_verified_content_hash(
    client, auth_headers, db_session
):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    upload = client.post(
        f"/api/records/{record['id']}/documents",
        headers=auth_headers,
        json={
            "document_type": "photo_id",
            "content_hash": "b" * 64,
        },
    ).json()

    # Default: verify without an explicit observed hash falls back to content_hash.
    verify = client.post(
        f"/api/documents/{upload['id']}/verify",
        headers=auth_headers,
        json={},
    ).json()
    assert verify["verified_content_hash"] == "b" * 64

    # Explicit: a later re-verification can record an independent observed hash.
    verify_explicit = client.post(
        f"/api/documents/{upload['id']}/verify",
        headers=auth_headers,
        json={"verified_content_hash": "c" * 64},
    ).json()
    assert verify_explicit["verified_content_hash"] == "c" * 64
