"""Phase 5 hardening tests.

Covers:
- content-endpoint header hardening (nosniff, cache-control, accept-ranges,
  inline vs attachment disposition)
- Range request handling (full, prefix, suffix, invalid)
- record evidence-summary endpoint counts and bytes
- storage-inventory report (referenced / dangling / orphans) with safe
  org-scoped semantics
"""

from __future__ import annotations

import hashlib

from sqlalchemy import select

from app.core import evidence_storage
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
            "subject_full_name": "Phase 5 Subject",
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
    body: bytes = PNG_HEADER + b"phase5",
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
# A. content headers
# --------------------------------------------------------------------------


def test_content_response_sets_security_headers(client, auth_headers, db_session):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    doc = _upload(client, auth_headers, record["id"]).json()

    response = client.get(
        f"/api/documents/{doc['id']}/content", headers=auth_headers
    )
    assert response.status_code == 200
    assert response.headers["x-content-type-options"] == "nosniff"
    assert "no-store" in response.headers["cache-control"].lower()
    assert response.headers["accept-ranges"] == "bytes"
    # Default disposition remains attachment for safety.
    assert response.headers["content-disposition"].startswith("attachment")


def test_inline_disposition_for_previewable_type(client, auth_headers, db_session):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    doc = _upload(client, auth_headers, record["id"]).json()

    response = client.get(
        f"/api/documents/{doc['id']}/content?disposition=inline",
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.headers["content-disposition"].startswith("inline")


def test_inline_disposition_downgrades_for_non_previewable_type(
    client, auth_headers, db_session
):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    # Register a metadata-only doc with a non-previewable mime, then
    # attach bytes directly to its storage_uri via the ORM so the content
    # endpoint finds real bytes. The route still sees mime_type=text/plain
    # and must refuse to inline it.
    upload = _upload(client, auth_headers, record["id"]).json()
    orm_doc = db_session.get(Document, upload["id"])
    orm_doc.mime_type = "text/plain"
    db_session.commit()

    response = client.get(
        f"/api/documents/{upload['id']}/content?disposition=inline",
        headers=auth_headers,
    )
    assert response.status_code == 200
    # Route forces attachment even though caller asked for inline.
    assert response.headers["content-disposition"].startswith("attachment")


def test_invalid_disposition_is_rejected(client, auth_headers, db_session):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    doc = _upload(client, auth_headers, record["id"]).json()
    response = client.get(
        f"/api/documents/{doc['id']}/content?disposition=weird",
        headers=auth_headers,
    )
    assert response.status_code == 422


# --------------------------------------------------------------------------
# B. range support
# --------------------------------------------------------------------------


def test_range_returns_partial_content(client, auth_headers, db_session):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    body = PNG_HEADER + b"A" * 512 + b"B" * 256
    doc = _upload(client, auth_headers, record["id"], body=body).json()
    total = len(body)

    response = client.get(
        f"/api/documents/{doc['id']}/content",
        headers={**auth_headers, "Range": "bytes=8-15"},
    )
    assert response.status_code == 206
    assert response.headers["content-range"] == f"bytes 8-15/{total}"
    assert response.headers["content-length"] == "8"
    assert response.content == body[8:16]


def test_range_without_end_streams_to_eof(client, auth_headers, db_session):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    body = PNG_HEADER + b"payload"
    doc = _upload(client, auth_headers, record["id"], body=body).json()
    total = len(body)

    response = client.get(
        f"/api/documents/{doc['id']}/content",
        headers={**auth_headers, "Range": "bytes=4-"},
    )
    assert response.status_code == 206
    assert response.headers["content-range"] == f"bytes 4-{total - 1}/{total}"
    assert response.content == body[4:]


def test_suffix_range_returns_last_n_bytes(client, auth_headers, db_session):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    body = PNG_HEADER + b"0123456789"
    doc = _upload(client, auth_headers, record["id"], body=body).json()
    total = len(body)

    response = client.get(
        f"/api/documents/{doc['id']}/content",
        headers={**auth_headers, "Range": "bytes=-4"},
    )
    assert response.status_code == 206
    assert response.content == body[-4:]
    assert response.headers["content-range"] == f"bytes {total - 4}-{total - 1}/{total}"


def test_invalid_range_returns_416(client, auth_headers, db_session):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    body = PNG_HEADER + b"short"
    doc = _upload(client, auth_headers, record["id"], body=body).json()

    response = client.get(
        f"/api/documents/{doc['id']}/content",
        headers={**auth_headers, "Range": "bytes=9999-99999"},
    )
    assert response.status_code == 416
    assert response.headers["content-range"].startswith("bytes */")


def test_range_on_multi_range_request_is_refused(
    client, auth_headers, db_session
):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    body = PNG_HEADER + b"x" * 64
    doc = _upload(client, auth_headers, record["id"], body=body).json()

    response = client.get(
        f"/api/documents/{doc['id']}/content",
        headers={**auth_headers, "Range": "bytes=0-7,16-23"},
    )
    assert response.status_code == 416


def test_content_hash_from_reassembled_range_matches_ingest(
    client, auth_headers, db_session
):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    body = PNG_HEADER + b"A" * 200_000 + b"END"
    doc = _upload(client, auth_headers, record["id"], body=body).json()
    total = len(body)

    # Reassemble via a handful of ranges and confirm the full hash matches.
    pieces: list[bytes] = []
    for start in range(0, total, 50_000):
        end = min(start + 49_999, total - 1)
        part = client.get(
            f"/api/documents/{doc['id']}/content",
            headers={**auth_headers, "Range": f"bytes={start}-{end}"},
        )
        assert part.status_code == 206
        pieces.append(part.content)
    assembled = b"".join(pieces)
    assert hashlib.sha256(assembled).hexdigest() == doc["content_hash"]


# --------------------------------------------------------------------------
# C. evidence-summary endpoint
# --------------------------------------------------------------------------


def test_evidence_summary_counts_and_bytes(client, auth_headers, db_session):
    record = _create_record(client, auth_headers, _workflow(db_session).id)

    big = PNG_HEADER + b"A" * 2048
    small = PNG_HEADER + b"B"
    _upload(client, auth_headers, record["id"], body=big)
    uploaded = _upload(client, auth_headers, record["id"], body=small).json()
    # Register a metadata-only row.
    client.post(
        f"/api/records/{record['id']}/documents",
        headers=auth_headers,
        json={"document_type": "other"},
    )
    # Verify one doc so `verified` > 0.
    client.post(
        f"/api/documents/{uploaded['id']}/verify",
        headers=auth_headers,
        json={},
    )

    response = client.get(
        f"/api/records/{record['id']}/evidence-summary", headers=auth_headers
    )
    assert response.status_code == 200
    body = response.json()
    assert body["record_id"] == record["id"]
    assert body["documents_total"] == 3
    assert body["upload_backed"] == 2
    assert body["metadata_only"] == 1
    assert body["verified"] >= 1
    assert body["integrity_checkable"] == 2
    assert body["stored_bytes"] == len(big) + len(small)
    assert body["missing_content"] == 0


def test_evidence_summary_flags_missing_content(
    client, auth_headers, db_session
):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    doc = _upload(client, auth_headers, record["id"]).json()
    # Vanish the file on disk. The summary should surface this.
    path = _local_path(db_session, doc["id"])
    assert path is not None
    path.unlink()

    body = client.get(
        f"/api/records/{record['id']}/evidence-summary", headers=auth_headers
    ).json()
    assert body["upload_backed"] == 1
    assert body["missing_content"] == 1
    assert body["stored_bytes"] == 0


def test_evidence_summary_404_for_unknown_record(client, auth_headers):
    response = client.get(
        "/api/records/999999/evidence-summary", headers=auth_headers
    )
    assert response.status_code == 404


# --------------------------------------------------------------------------
# D. storage-inventory endpoint
# --------------------------------------------------------------------------


def test_storage_inventory_counts_referenced_and_orphans(
    client, auth_headers, db_session, tmp_path, monkeypatch
):
    from app.core.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(
        settings, "evidence_storage_dir", str(tmp_path), raising=False
    )

    record = _create_record(client, auth_headers, _workflow(db_session).id)
    first = _upload(client, auth_headers, record["id"]).json()
    second = _upload(
        client, auth_headers, record["id"], body=PNG_HEADER + b"second"
    ).json()

    # Plant an orphan file inside the managed root.
    orphan = tmp_path / "abc123.bin"
    orphan.write_bytes(PNG_HEADER + b"orphan-bytes")

    # Delete one file on disk to simulate a dangling DB reference.
    dangling_path = _local_path(db_session, second["id"])
    assert dangling_path is not None
    dangling_path.unlink()

    response = client.get(
        "/api/audit/storage-inventory", headers=auth_headers
    )
    assert response.status_code == 200
    body = response.json()

    # Two files we wrote (first upload + orphan); the second upload's
    # file was unlinked.
    assert body["managed_files_on_disk"] == 2
    assert body["orphaned_files"] >= 1
    assert body["referenced_by_organization"] == 1
    assert body["dangling_references_in_organization"] == 1
    # Referenced bytes match the first upload.
    expected_bytes = (
        _local_path(db_session, first["id"]).stat().st_size  # type: ignore[union-attr]
    )
    assert body["total_bytes_referenced_by_organization"] == expected_bytes


def test_storage_inventory_requires_auth(client):
    response = client.get("/api/audit/storage-inventory")
    assert response.status_code == 401


# --------------------------------------------------------------------------
# E. evidence_storage.iter_managed_files stays inside the managed root
# --------------------------------------------------------------------------


def test_iter_managed_files_ignores_files_outside_root(tmp_path, monkeypatch):
    from app.core.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(
        settings, "evidence_storage_dir", str(tmp_path), raising=False
    )

    inside = tmp_path / "keep.bin"
    inside.write_bytes(b"inside")
    outside = tmp_path.parent / f"outside-{tmp_path.name}.bin"
    outside.write_bytes(b"outside")

    found = {
        str(path.resolve()) for path, _size in evidence_storage.iter_managed_files()
    }
    assert str(inside.resolve()) in found
    assert str(outside.resolve()) not in found

    # Keep the test clean.
    outside.unlink(missing_ok=True)
