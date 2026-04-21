"""Phase 4 hardening tests.

Covers:
- secure content delivery (`GET /documents/{id}/content`): serves
  upload-backed documents, rejects metadata-only rows, blocks
  cross-organization access, sets Content-Disposition safely
- streaming upload path computes correct hash and size, aborts on
  oversize without leaving partial files
- record-level delete removes the record, cascaded documents, and
  managed files on disk
- integrity-mismatch audit payload now goes through the canonical
  builder
- audit chain verification endpoint reports ok on a clean chain and
  flags tampering
"""

from __future__ import annotations

import hashlib

import pytest
from sqlalchemy import select

from app.core import evidence_storage
from app.models.audit import AuditLog
from app.models.document import Document
from app.models.record import Record
from app.models.workflow import Workflow


PNG_HEADER = b"\x89PNG\r\n\x1a\n"


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
            "subject_full_name": "Phase 4 Subject",
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
    body: bytes = PNG_HEADER + b"phase4",
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


def _local_path(db_session, document_id: int):
    orm_doc = db_session.get(Document, document_id)
    db_session.refresh(orm_doc)
    return evidence_storage.resolve_local_path(orm_doc.storage_uri)


# --------------------------------------------------------------------------
# A. content delivery
# --------------------------------------------------------------------------


def test_content_endpoint_streams_upload_backed_document(
    client, auth_headers, db_session
):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    content = PNG_HEADER + b"served-back-exactly"
    doc = _upload(client, auth_headers, record["id"], body=content).json()

    response = client.get(
        f"/api/documents/{doc['id']}/content", headers=auth_headers
    )
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("image/png")
    assert "attachment" in response.headers["content-disposition"]
    assert response.content == content


def test_content_endpoint_rejects_metadata_only_document(
    client, auth_headers, db_session
):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    doc = client.post(
        f"/api/records/{record['id']}/documents",
        headers=auth_headers,
        json={"document_type": "photo_id"},
    ).json()

    response = client.get(
        f"/api/documents/{doc['id']}/content", headers=auth_headers
    )
    assert response.status_code == 404


def test_content_endpoint_requires_authentication(client, auth_headers, db_session):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    doc = _upload(client, auth_headers, record["id"]).json()

    # Phase 8A added cookie auth; the TestClient's cookie jar would
    # otherwise carry the session cookie from `_upload` and keep the
    # request authenticated. Clear it so we are testing the real
    # no-auth case.
    client.cookies.clear()
    response = client.get(f"/api/documents/{doc['id']}/content")
    assert response.status_code == 401


def test_content_endpoint_cross_org_is_denied(client, auth_headers, db_session):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    doc = _upload(client, auth_headers, record["id"]).json()

    # Point the backing record at a foreign organization and confirm the
    # endpoint treats the document as not visible to the caller.
    from app.models.organization import Organization

    other_org = Organization(name="Other Org", slug="phase4-other")
    db_session.add(other_org)
    db_session.flush()
    record_row = db_session.get(Record, record["id"])
    record_row.organization_id = other_org.id
    db_session.commit()

    response = client.get(
        f"/api/documents/{doc['id']}/content", headers=auth_headers
    )
    # get_record returns None (out of org), so the document_service sees
    # the document as not-found from the caller's perspective.
    assert response.status_code in (403, 404)


def test_content_disposition_filename_is_sanitized(
    client, auth_headers, db_session
):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    # Upload with a hostile-looking filename.
    body = PNG_HEADER + b"payload"
    upload = client.post(
        f"/api/records/{record['id']}/documents/upload",
        headers=auth_headers,
        data={"document_type": "photo_id"},
        files={"file": ("../../etc/weird name.png", body, "image/png")},
    )
    assert upload.status_code == 201, upload.text
    doc_id = upload.json()["id"]

    response = client.get(f"/api/documents/{doc_id}/content", headers=auth_headers)
    assert response.status_code == 200
    cd = response.headers["content-disposition"]
    # Never emit path separators in the download name.
    assert ".." not in cd
    assert "/" not in cd
    assert "weird" in cd  # sanitized stem survives


# --------------------------------------------------------------------------
# B. streaming upload
# --------------------------------------------------------------------------


def test_streaming_upload_preserves_large_payload_integrity(
    client, auth_headers, db_session
):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    # Larger than the 32-byte detection peek but well under max_upload_bytes.
    body = PNG_HEADER + (b"A" * 256 * 1024) + b"tail"
    expected_hash = hashlib.sha256(body).hexdigest()

    response = _upload(client, auth_headers, record["id"], body=body)
    assert response.status_code == 201, response.text
    doc = response.json()
    assert doc["size_bytes"] == len(body)
    assert doc["content_hash"] == expected_hash

    # Round-trip through /content to confirm the bytes on disk match.
    download = client.get(
        f"/api/documents/{doc['id']}/content", headers=auth_headers
    )
    assert download.status_code == 200
    assert download.content == body
    assert hashlib.sha256(download.content).hexdigest() == expected_hash


def test_streaming_upload_aborts_and_cleans_up_on_oversize(
    client, auth_headers, db_session, monkeypatch, tmp_path
):
    from app.core.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(settings, "max_upload_bytes", 64, raising=False)

    # Isolate storage to this test's tmp dir so the "no orphans" assertion
    # cannot be polluted by other uploads performed in the same test run.
    monkeypatch.setattr(
        settings, "evidence_storage_dir", str(tmp_path), raising=False
    )

    record = _create_record(client, auth_headers, _workflow(db_session).id)
    body = PNG_HEADER + (b"X" * 1024)  # larger than 64 bytes

    response = _upload(client, auth_headers, record["id"], body=body)
    assert response.status_code == 413
    # No evidence row should exist for this record.
    docs = client.get(
        f"/api/records/{record['id']}/documents", headers=auth_headers
    ).json()
    assert docs == []
    # And no orphan blob on disk.
    leftover = [p for p in tmp_path.iterdir() if p.is_file()]
    assert leftover == []


def test_streaming_upload_rejects_empty_payload(
    client, auth_headers, db_session
):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    response = _upload(client, auth_headers, record["id"], body=b"")
    assert response.status_code == 400


def test_streaming_upload_rejects_unsupported_type(
    client, auth_headers, db_session
):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    response = client.post(
        f"/api/records/{record['id']}/documents/upload",
        headers=auth_headers,
        data={"document_type": "photo_id"},
        files={"file": ("notes.txt", b"plain text", "text/plain")},
    )
    assert response.status_code == 415


# --------------------------------------------------------------------------
# C. record-level cleanup
# --------------------------------------------------------------------------


def test_delete_record_removes_documents_and_managed_files(
    client, auth_headers, db_session
):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    doc_a = _upload(client, auth_headers, record["id"]).json()
    doc_b = _upload(
        client,
        auth_headers,
        record["id"],
        body=PNG_HEADER + b"second",
    ).json()

    path_a = _local_path(db_session, doc_a["id"])
    path_b = _local_path(db_session, doc_b["id"])
    assert path_a is not None and path_a.is_file()
    assert path_b is not None and path_b.is_file()

    version = client.get(
        f"/api/records/{record['id']}", headers=auth_headers
    ).json()["version"]

    response = client.delete(
        f"/api/records/{record['id']}?expected_version={version}",
        headers=auth_headers,
    )
    assert response.status_code == 204

    # Record gone.
    assert db_session.get(Record, record["id"]) is None
    # Documents gone (cascade on record delete).
    assert (
        db_session.execute(
            select(Document).where(Document.id.in_([doc_a["id"], doc_b["id"]]))
        )
        .scalars()
        .all()
        == []
    )
    # Files gone.
    assert not path_a.exists()
    assert not path_b.exists()


def test_delete_record_with_stale_version_returns_conflict(
    client, auth_headers, db_session
):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    response = client.delete(
        f"/api/records/{record['id']}?expected_version=999",
        headers=auth_headers,
    )
    assert response.status_code == 409
    assert db_session.get(Record, record["id"]) is not None


def test_delete_record_emits_audit_event_with_counts(
    client, auth_headers, db_session
):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    _upload(client, auth_headers, record["id"])
    _upload(client, auth_headers, record["id"], body=PNG_HEADER + b"x")

    version = client.get(
        f"/api/records/{record['id']}", headers=auth_headers
    ).json()["version"]
    client.delete(
        f"/api/records/{record['id']}?expected_version={version}",
        headers=auth_headers,
    )

    row = db_session.execute(
        select(AuditLog)
        .where(AuditLog.action == "record.deleted")
        .order_by(AuditLog.id.desc())
    ).scalars().first()
    assert row is not None
    assert row.payload["record_id"] == record["id"]
    assert row.payload["documents_removed"] == 2
    assert row.payload["stored_files_removed"] == 2
    assert row.payload["deleted_by"] is not None


def test_delete_record_does_not_touch_paths_outside_storage_root(
    client, auth_headers, db_session, tmp_path
):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    # Plant a Document with a storage_uri pointing outside the storage root.
    # `delete_local_object` must refuse to remove it.
    rogue = tmp_path / "outside.bin"
    rogue.write_bytes(b"must-survive")
    from app.models.document import Document as DocumentModel
    from app.models.enums import DocumentStatus, DocumentType

    doc = DocumentModel(
        record_id=record["id"],
        document_type=DocumentType.OTHER,
        status=DocumentStatus.UPLOADED,
        storage_uri=f"file:{rogue.resolve()}",
    )
    db_session.add(doc)
    db_session.commit()

    version = client.get(
        f"/api/records/{record['id']}", headers=auth_headers
    ).json()["version"]
    response = client.delete(
        f"/api/records/{record['id']}?expected_version={version}",
        headers=auth_headers,
    )
    assert response.status_code == 204

    # The rogue file outside the storage root is still there.
    assert rogue.exists()
    assert rogue.read_bytes() == b"must-survive"


# --------------------------------------------------------------------------
# D. audit payload normalization
# --------------------------------------------------------------------------


def test_integrity_failed_event_uses_canonical_payload(
    client, auth_headers, db_session
):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    doc = _upload(client, auth_headers, record["id"]).json()

    path = _local_path(db_session, doc["id"])
    assert path is not None
    path.write_bytes(b"tampered")

    verify = client.post(
        f"/api/documents/{doc['id']}/verify", headers=auth_headers, json={}
    )
    assert verify.status_code == 409

    row = db_session.execute(
        select(AuditLog)
        .where(AuditLog.action == "document.integrity_failed")
        .order_by(AuditLog.id.desc())
    ).scalars().first()
    assert row is not None
    for key in (
        "record_id",
        "document_id",
        "document_type",
        "document_status",
        "expected_content_hash",
        "actual_content_hash",
    ):
        assert key in row.payload, f"missing key {key}"
    assert row.payload["document_status"] == "rejected"


# --------------------------------------------------------------------------
# E. audit chain verification
# --------------------------------------------------------------------------


def test_audit_chain_verify_reports_ok_for_clean_chain(
    client, auth_headers, db_session
):
    # Generate a handful of events in the org so the chain has material.
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    _upload(client, auth_headers, record["id"])
    _upload(client, auth_headers, record["id"], body=PNG_HEADER + b"b")

    response = client.get("/api/audit/verify", headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert body["checked"] > 0
    assert body["broken_entries"] == []
    assert body["broken_links"] == []


def test_audit_chain_verify_detects_tampering(
    client, auth_headers, db_session
):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    _upload(client, auth_headers, record["id"])

    # Tamper with one audit row's payload without recomputing its hash.
    latest = db_session.execute(
        select(AuditLog).order_by(AuditLog.id.desc())
    ).scalars().first()
    assert latest is not None
    tampered_payload = {**(latest.payload or {}), "injected": "bad"}
    latest.payload = tampered_payload
    db_session.commit()

    response = client.get("/api/audit/verify", headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is False
    assert any(
        entry["audit_id"] == latest.id for entry in body["broken_entries"]
    )


def test_audit_chain_verify_requires_auth(client):
    response = client.get("/api/audit/verify")
    assert response.status_code == 401
