"""Phase 6 hardening tests.

Covers:
- signed content-access tokens: happy path, expiry, scope, metadata-only
  ineligibility, bad token rejection
- admin/debug routes (audit verify, storage inventory, storage cleanup)
  require the ADMIN role
- safe orphan cleanup (dry-run vs destructive), never deletes outside
  managed storage root
- app-wide security headers (CSP, Referrer-Policy, nosniff,
  Permissions-Policy) are present and compatible with content flows
- Swagger / OpenAPI docs paths remain usable (no blanket CSP applied)
"""

from __future__ import annotations

import hashlib
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict

import pytest
from sqlalchemy import select

from app.core import evidence_storage
from app.core.security import (
    CONTENT_ACCESS_AUDIENCE,
    CONTENT_ACCESS_TOKEN_TYPE,
    create_content_access_token,
    decode_content_access_token,
)
from app.models.audit import AuditLog
from app.models.document import Document
from app.models.enums import UserRole
from app.models.user import User
from app.models.workflow import Workflow


PNG_HEADER = b"\x89PNG\r\n\x1a\n"


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------


def _workflow(db_session) -> Workflow:
    return db_session.execute(
        select(Workflow).where(Workflow.slug == "healthcare-intake")
    ).scalar_one()


def _create_record(client, auth_headers, workflow_id):
    response = client.post(
        "/api/records",
        headers=auth_headers,
        json={
            "workflow_id": workflow_id,
            "subject_full_name": "Phase 6 Subject",
            "subject_dob": "1990-01-01",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def _upload(
    client,
    auth_headers,
    record_id,
    *,
    body: bytes = PNG_HEADER + b"phase6",
    filename: str = "doc.png",
    mime: str = "image/png",
    document_type: str = "photo_id",
):
    return client.post(
        f"/api/records/{record_id}/documents/upload",
        headers=auth_headers,
        data={"document_type": document_type},
        files={"file": (filename, body, mime)},
    )


def _login(client, email: str, password: str = "VeriFlow!2025") -> str:
    response = client.post(
        "/api/auth/login", json={"email": email, "password": password}
    )
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


# --------------------------------------------------------------------------
# A. signed-access tokens
# --------------------------------------------------------------------------


def test_signed_access_happy_path(client, auth_headers, db_session):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    doc = _upload(client, auth_headers, record["id"]).json()

    grant = client.post(
        f"/api/documents/{doc['id']}/signed-access",
        headers=auth_headers,
        json={"disposition": "inline"},
    )
    assert grant.status_code == 200, grant.text
    body = grant.json()
    assert body["document_id"] == doc["id"]
    assert body["disposition"] == "inline"
    assert body["token"]
    assert body["url"].startswith("/documents/content/signed?token=")

    response = client.get(body["url"] and body["url"].replace("/documents", "/api/documents"))
    # The grant URL is API-relative; TestClient needs the /api prefix.
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("image/png")
    assert response.content.startswith(PNG_HEADER)


def test_signed_access_for_metadata_only_is_rejected(
    client, auth_headers, db_session
):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    doc = client.post(
        f"/api/records/{record['id']}/documents",
        headers=auth_headers,
        json={"document_type": "photo_id"},
    ).json()
    response = client.post(
        f"/api/documents/{doc['id']}/signed-access",
        headers=auth_headers,
        json={"disposition": "inline"},
    )
    assert response.status_code == 404


def test_signed_access_rejects_cross_organization(
    client, auth_headers, db_session
):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    doc = _upload(client, auth_headers, record["id"]).json()

    grant = client.post(
        f"/api/documents/{doc['id']}/signed-access",
        headers=auth_headers,
        json={"disposition": "inline"},
    ).json()

    # Move the record to a different organization after minting the token.
    from app.models.organization import Organization

    other = Organization(name="Other Org", slug="phase6-other")
    db_session.add(other)
    db_session.flush()
    rec_row = db_session.get(Document, doc["id"]).record
    rec_row.organization_id = other.id
    db_session.commit()

    response = client.get(f"/api/documents/content/signed?token={grant['token']}")
    assert response.status_code == 403


def test_signed_content_rejects_missing_or_bad_token(client):
    response = client.get("/api/documents/content/signed")
    assert response.status_code == 422  # missing required query param
    response = client.get("/api/documents/content/signed?token=not-a-jwt")
    assert response.status_code == 401


def test_signed_token_expires(client, auth_headers, db_session):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    doc = _upload(client, auth_headers, record["id"]).json()
    # Mint a 1-second token and wait out its lifetime.
    grant = client.post(
        f"/api/documents/{doc['id']}/signed-access",
        headers=auth_headers,
        json={"disposition": "inline", "ttl_seconds": 10},
    )
    assert grant.status_code == 200, grant.text

    # Drop in an already-expired token manually to avoid a real sleep.
    expired_token, _ = create_content_access_token(
        document_id=doc["id"],
        organization_id=db_session.get(Document, doc["id"]).record.organization_id,
        user_id=1,
        disposition="inline",
        ttl_seconds=-30,  # iat/exp in the past
    )
    response = client.get(
        f"/api/documents/content/signed?token={expired_token}"
    )
    assert response.status_code == 401


def test_signed_token_rejects_wrong_typ():
    # Hand-forge a token that looks right but has typ=access; decode must
    # refuse it even though signature is valid.
    from jose import jwt

    from app.core.config import get_settings
    from app.core.security import TokenValidationError

    settings = get_settings()
    now = int(datetime.now(tz=timezone.utc).timestamp())
    token = jwt.encode(
        {
            "sub": "1",
            "iat": now,
            "nbf": now,
            "exp": now + 120,
            "iss": settings.jwt_issuer,
            "aud": CONTENT_ACCESS_AUDIENCE,
            "typ": "access",  # wrong typ
            "jti": "x",
            "doc": 1,
            "org": 1,
            "disp": "inline",
        },
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )
    with pytest.raises(TokenValidationError):
        decode_content_access_token(token)


def test_signed_access_ignores_disposition_for_non_previewable_mime(
    client, auth_headers, db_session
):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    doc = _upload(client, auth_headers, record["id"]).json()
    # Downgrade its mime_type to something outside the inline allowlist.
    orm_doc = db_session.get(Document, doc["id"])
    orm_doc.mime_type = "text/plain"
    db_session.commit()

    grant = client.post(
        f"/api/documents/{doc['id']}/signed-access",
        headers=auth_headers,
        json={"disposition": "inline"},
    ).json()
    response = client.get(f"/api/documents/content/signed?token={grant['token']}")
    assert response.status_code == 200
    assert response.headers["content-disposition"].startswith("attachment")


# --------------------------------------------------------------------------
# B. admin-gated audit routes
# --------------------------------------------------------------------------


def test_audit_verify_denies_non_admin(client):
    token = _login(client, "intake@veriflow.demo")
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/audit/verify", headers=headers)
    assert response.status_code == 403


def test_audit_verify_allows_admin(client, auth_headers):
    response = client.get("/api/audit/verify", headers=auth_headers)
    assert response.status_code == 200


def test_storage_inventory_denies_non_admin(client):
    token = _login(client, "reviewer@veriflow.demo")
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/audit/storage-inventory", headers=headers)
    assert response.status_code == 403


def test_storage_cleanup_denies_non_admin(client):
    token = _login(client, "manager@veriflow.demo")
    headers = {"Authorization": f"Bearer {token}"}
    response = client.post("/api/audit/storage-cleanup", headers=headers)
    assert response.status_code == 403


# --------------------------------------------------------------------------
# C. safe orphan cleanup
# --------------------------------------------------------------------------


def test_storage_cleanup_dry_run_reports_but_keeps_files(
    client, auth_headers, db_session, tmp_path, monkeypatch
):
    from app.core.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(
        settings, "evidence_storage_dir", str(tmp_path), raising=False
    )

    record = _create_record(client, auth_headers, _workflow(db_session).id)
    _upload(client, auth_headers, record["id"])  # referenced
    orphan = tmp_path / "orphan.bin"
    orphan.write_bytes(PNG_HEADER + b"orphan-bytes")

    response = client.post(
        "/api/audit/storage-cleanup?dry_run=true", headers=auth_headers
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["dry_run"] is True
    assert body["orphaned_found"] >= 1
    assert body["orphaned_deleted"] == 0
    assert body["bytes_reclaimed"] == 0
    assert orphan.exists()


def test_storage_cleanup_destructive_removes_only_orphans(
    client, auth_headers, db_session, tmp_path, monkeypatch
):
    from app.core.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(
        settings, "evidence_storage_dir", str(tmp_path), raising=False
    )

    record = _create_record(client, auth_headers, _workflow(db_session).id)
    live = _upload(client, auth_headers, record["id"]).json()
    live_orm = db_session.get(Document, live["id"])
    live_path = evidence_storage.resolve_local_path(live_orm.storage_uri)
    assert live_path is not None

    orphan_a = tmp_path / "orphan-a.bin"
    orphan_a.write_bytes(PNG_HEADER + b"a")
    orphan_b = tmp_path / "orphan-b.bin"
    orphan_b.write_bytes(PNG_HEADER + b"b" * 32)
    expected_bytes = orphan_a.stat().st_size + orphan_b.stat().st_size

    response = client.post(
        "/api/audit/storage-cleanup?dry_run=false", headers=auth_headers
    )
    assert response.status_code == 200
    body = response.json()
    assert body["dry_run"] is False
    assert body["orphaned_found"] >= 2
    assert body["orphaned_deleted"] >= 2
    assert body["bytes_reclaimed"] >= expected_bytes
    assert body["errors"] == 0

    # Orphans gone, live file preserved.
    assert not orphan_a.exists()
    assert not orphan_b.exists()
    assert live_path.exists()


def test_storage_cleanup_emits_audit_event(client, auth_headers, db_session):
    response = client.post(
        "/api/audit/storage-cleanup?dry_run=true", headers=auth_headers
    )
    assert response.status_code == 200
    row = db_session.execute(
        select(AuditLog)
        .where(AuditLog.action == "storage.cleanup")
        .order_by(AuditLog.id.desc())
    ).scalars().first()
    assert row is not None
    for key in (
        "dry_run",
        "files_examined",
        "orphaned_found",
        "orphaned_deleted",
        "bytes_reclaimed",
        "errors",
    ):
        assert key in row.payload


def test_delete_file_inside_root_refuses_outside_paths(tmp_path, monkeypatch):
    from pathlib import Path

    from app.core.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(
        settings, "evidence_storage_dir", str(tmp_path), raising=False
    )

    outside = tmp_path.parent / f"outside-{tmp_path.name}.bin"
    outside.write_bytes(b"do-not-delete")
    assert evidence_storage.delete_file_inside_root(outside) is False
    assert outside.exists()
    outside.unlink(missing_ok=True)

    inside = tmp_path / "inside.bin"
    inside.write_bytes(b"ok")
    assert evidence_storage.delete_file_inside_root(inside) is True
    assert not inside.exists()


# --------------------------------------------------------------------------
# D. security headers
# --------------------------------------------------------------------------


def test_security_headers_present_on_json_routes(client, auth_headers):
    response = client.get("/api/records", headers=auth_headers)
    assert response.status_code == 200
    assert response.headers["x-content-type-options"] == "nosniff"
    assert "referrer-policy" in response.headers
    assert "content-security-policy" in response.headers
    assert "permissions-policy" in response.headers


def test_security_headers_do_not_block_content(client, auth_headers, db_session):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    doc = _upload(client, auth_headers, record["id"]).json()
    response = client.get(
        f"/api/documents/{doc['id']}/content", headers=auth_headers
    )
    assert response.status_code == 200
    # Content route sets its own narrow CSP-relevant headers; middleware's
    # headers should still be present and compatible.
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["cache-control"].startswith("private")


def test_interactive_docs_not_blanket_csp_restricted(client):
    response = client.get("/openapi.json")
    assert response.status_code == 200
    # CSP is intentionally not applied to interactive docs so Swagger /
    # ReDoc can load their vendor assets; other baseline headers still
    # apply.
    assert response.headers["x-content-type-options"] == "nosniff"
    assert "content-security-policy" not in response.headers
