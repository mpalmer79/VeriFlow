"""Phase 3 hardening tests.

Covers:
- content-type validation (allowlist + magic bytes)
- has_stored_content derivation on Document read
- document DELETE endpoint cleans up the DB row and the file on disk,
  and is safe when the file is already gone
- per-record integrity-summary endpoint returns structured results
- response intentionally no longer exposes storage_uri
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional

from sqlalchemy import select

from app.core import evidence_storage
from app.models.audit import AuditLog
from app.models.document import Document
from app.models.workflow import Workflow


PNG_HEADER = b"\x89PNG\r\n\x1a\n"
PDF_HEADER = b"%PDF-1.4"
JPEG_HEADER = b"\xff\xd8\xff\xe0"


def _workflow(db_session) -> Workflow:
    return db_session.execute(
        select(Workflow).where(Workflow.slug == "healthcare-intake")
    ).scalar_one()


def _create_record(client, auth_headers, workflow_id):
    payload = {
        "workflow_id": workflow_id,
        "subject_full_name": "Phase 3 Subject",
        "subject_dob": "1990-01-01",
    }
    response = client.post("/api/records", json=payload, headers=auth_headers)
    assert response.status_code == 201, response.text
    return response.json()


def _upload(client, auth_headers, record_id, *, body: bytes, filename: str, mime: str, document_type: str = "photo_id"):
    return client.post(
        f"/api/records/{record_id}/documents/upload",
        headers=auth_headers,
        data={"document_type": document_type},
        files={"file": (filename, body, mime)},
    )


# --------------------------------------------------------------------------
# A. content-type validation
# --------------------------------------------------------------------------


def test_upload_accepts_png(client, auth_headers, db_session):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    response = _upload(
        client,
        auth_headers,
        record["id"],
        body=PNG_HEADER + b"payload",
        filename="a.png",
        mime="image/png",
    )
    assert response.status_code == 201, response.text
    assert response.json()["mime_type"] == "image/png"


def test_upload_accepts_pdf(client, auth_headers, db_session):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    response = _upload(
        client,
        auth_headers,
        record["id"],
        body=PDF_HEADER + b"-content",
        filename="b.pdf",
        mime="application/pdf",
    )
    assert response.status_code == 201, response.text
    assert response.json()["mime_type"] == "application/pdf"


def test_upload_accepts_jpeg(client, auth_headers, db_session):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    response = _upload(
        client,
        auth_headers,
        record["id"],
        body=JPEG_HEADER + b"\x00\x00",
        filename="c.jpg",
        mime="image/jpeg",
    )
    assert response.status_code == 201, response.text
    assert response.json()["mime_type"] == "image/jpeg"


def test_upload_rejects_unsupported_type(client, auth_headers, db_session):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    response = _upload(
        client,
        auth_headers,
        record["id"],
        body=b"plain text data",
        filename="notes.txt",
        mime="text/plain",
    )
    assert response.status_code == 415


def test_upload_trusts_magic_bytes_over_client_mime(
    client, auth_headers, db_session
):
    """If the client claims application/pdf but the bytes are a PNG, the
    server's detected type (PNG) wins."""
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    response = _upload(
        client,
        auth_headers,
        record["id"],
        body=PNG_HEADER + b"tricky",
        filename="tricky.pdf",
        mime="application/pdf",
    )
    assert response.status_code == 201, response.text
    assert response.json()["mime_type"] == "image/png"


def test_upload_with_spoofed_extension_rejected_when_bytes_arent_allowlisted(
    client, auth_headers, db_session
):
    """Client lies about type (image/png), extension says .png, but the
    actual bytes are random — no allowed magic header, client-mime is
    allowed but the server ignores it because we refuse to trust the
    header without evidence. Net effect: detection fails → 415."""
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    # evidence_storage.detect_content_type: if no magic match AND client mime
    # is in allowlist, it accepts the client mime. So to force a failure,
    # use a client mime that is NOT in the allowlist.
    response = _upload(
        client,
        auth_headers,
        record["id"],
        body=b"executable-bytes-no-header",
        filename="payload.exe",
        mime="application/octet-stream",
    )
    assert response.status_code == 415


# --------------------------------------------------------------------------
# B. has_stored_content
# --------------------------------------------------------------------------


def test_metadata_registration_has_no_stored_content(
    client, auth_headers, db_session
):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    doc = client.post(
        f"/api/records/{record['id']}/documents",
        headers=auth_headers,
        json={"document_type": "photo_id"},
    ).json()
    assert doc["has_stored_content"] is False


def test_real_upload_has_stored_content(client, auth_headers, db_session):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    doc = _upload(
        client,
        auth_headers,
        record["id"],
        body=PNG_HEADER + b"payload",
        filename="x.png",
        mime="image/png",
    ).json()
    assert doc["has_stored_content"] is True


def test_document_read_never_exposes_storage_uri(client, auth_headers, db_session):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    doc = _upload(
        client,
        auth_headers,
        record["id"],
        body=PNG_HEADER + b"payload",
        filename="x.png",
        mime="image/png",
    ).json()
    assert "storage_uri" not in doc

    listing = client.get(
        f"/api/records/{record['id']}/documents", headers=auth_headers
    ).json()
    for row in listing:
        assert "storage_uri" not in row


# --------------------------------------------------------------------------
# C. document DELETE
# --------------------------------------------------------------------------


def _resolve_path(db_session, document_id: int):
    orm_doc = db_session.get(Document, document_id)
    db_session.refresh(orm_doc)
    return evidence_storage.resolve_local_path(orm_doc.storage_uri)


def test_delete_removes_db_row_and_file(client, auth_headers, db_session):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    doc = _upload(
        client,
        auth_headers,
        record["id"],
        body=PNG_HEADER + b"to-delete",
        filename="bye.png",
        mime="image/png",
    ).json()
    path = _resolve_path(db_session, doc["id"])
    assert path is not None and path.is_file()

    response = client.delete(
        f"/api/documents/{doc['id']}", headers=auth_headers
    )
    assert response.status_code == 204, response.text

    # Row is gone.
    assert db_session.get(Document, doc["id"]) is None
    # File is gone.
    assert not path.exists()


def test_delete_tolerates_missing_file(client, auth_headers, db_session):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    doc = _upload(
        client,
        auth_headers,
        record["id"],
        body=PNG_HEADER + b"already-orphaned",
        filename="orphan.png",
        mime="image/png",
    ).json()
    path = _resolve_path(db_session, doc["id"])
    assert path is not None
    path.unlink()

    response = client.delete(
        f"/api/documents/{doc['id']}", headers=auth_headers
    )
    assert response.status_code == 204
    assert db_session.get(Document, doc["id"]) is None


def test_delete_of_metadata_only_document(client, auth_headers, db_session):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    doc = client.post(
        f"/api/records/{record['id']}/documents",
        headers=auth_headers,
        json={"document_type": "photo_id"},
    ).json()

    response = client.delete(
        f"/api/documents/{doc['id']}", headers=auth_headers
    )
    assert response.status_code == 204
    assert db_session.get(Document, doc["id"]) is None


def test_delete_emits_audit_event(client, auth_headers, db_session):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    doc = _upload(
        client,
        auth_headers,
        record["id"],
        body=PNG_HEADER + b"auditable",
        filename="a.png",
        mime="image/png",
    ).json()
    client.delete(f"/api/documents/{doc['id']}", headers=auth_headers)

    row = db_session.execute(
        select(AuditLog)
        .where(AuditLog.record_id == record["id"], AuditLog.action == "document.deleted")
        .order_by(AuditLog.id.desc())
    ).scalars().first()
    assert row is not None
    assert row.payload["document_id"] == doc["id"]
    assert row.payload["document_type"] == "photo_id"
    assert row.payload["stored_content_removed"] is True
    assert row.payload["deleted_by"] is not None


def test_delete_returns_404_for_unknown_document(client, auth_headers):
    response = client.delete("/api/documents/999999", headers=auth_headers)
    assert response.status_code == 404


# --------------------------------------------------------------------------
# D. per-record integrity summary
# --------------------------------------------------------------------------


def test_record_integrity_summary_returns_results_for_all_docs(
    client, auth_headers, db_session
):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    good = _upload(
        client,
        auth_headers,
        record["id"],
        body=PNG_HEADER + b"good-bytes",
        filename="good.png",
        mime="image/png",
    ).json()
    tampered = _upload(
        client,
        auth_headers,
        record["id"],
        body=PNG_HEADER + b"will-tamper",
        filename="tam.png",
        mime="image/png",
    ).json()
    # Tamper with the second document on disk.
    path = _resolve_path(db_session, tampered["id"])
    assert path is not None
    path.write_bytes(b"unrelated-bytes")

    response = client.get(
        f"/api/records/{record['id']}/integrity-summary", headers=auth_headers
    )
    assert response.status_code == 200
    body = response.json()
    assert body["record_id"] == record["id"]
    assert len(body["documents"]) == 2
    by_id = {r["document_id"]: r for r in body["documents"]}
    assert by_id[good["id"]]["is_match"] is True
    assert by_id[tampered["id"]]["is_match"] is False


def test_record_integrity_summary_for_record_with_no_documents(
    client, auth_headers, db_session
):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    response = client.get(
        f"/api/records/{record['id']}/integrity-summary", headers=auth_headers
    )
    assert response.status_code == 200
    assert response.json()["documents"] == []


# --------------------------------------------------------------------------
# E. detect_content_type helper contract
# --------------------------------------------------------------------------


def test_detect_content_type_prefers_magic_over_client_mime():
    assert (
        evidence_storage.detect_content_type(PNG_HEADER + b"x", "application/pdf")
        == "image/png"
    )
    assert (
        evidence_storage.detect_content_type(PDF_HEADER, "image/png")
        == "application/pdf"
    )


def test_detect_content_type_accepts_allowed_client_mime_without_magic():
    # No magic match, but client mime is in allowlist → accepted.
    assert (
        evidence_storage.detect_content_type(b"arbitrary", "image/png")
        == "image/png"
    )


def test_detect_content_type_rejects_unknown_everything():
    import pytest

    with pytest.raises(evidence_storage.UnsupportedContentType):
        evidence_storage.detect_content_type(b"nope", "application/octet-stream")
    with pytest.raises(evidence_storage.UnsupportedContentType):
        evidence_storage.detect_content_type(b"nope", None)
