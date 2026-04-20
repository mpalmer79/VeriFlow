"""Phase 2 hardening tests.

Covers:
- real file hashing at ingest (content_hash + size_bytes come from bytes)
- verification re-hashes stored content and fails cleanly when bytes are
  missing or altered
- integrity-check endpoint returns a structured result for match / mismatch
  / missing-content
- blocked transitions no longer mutate persisted record risk fields
- Alembic metadata imports and the baseline migration loads cleanly
"""

from __future__ import annotations

import hashlib
from pathlib import Path

import pytest
from sqlalchemy import select

from app.core import evidence_storage
from app.models.document import Document
from app.models.record import Record
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
        "subject_full_name": overrides.pop("subject_full_name", "Phase 2 Subject"),
        "subject_dob": overrides.pop("subject_dob", "1990-01-01"),
    }
    payload.update(overrides)
    response = client.post("/api/records", json=payload, headers=auth_headers)
    assert response.status_code == 201, response.text
    return response.json()


PNG_HEADER = b"\x89PNG\r\n\x1a\n"


def _png(payload: bytes) -> bytes:
    """Prefix arbitrary test bytes with the PNG magic header so ingest
    content-type validation accepts the payload as a real image.
    """
    return PNG_HEADER + payload


def _upload_bytes(
    client, auth_headers, record_id, document_type, content, filename="doc.png"
):
    # Wrap raw test bytes in a PNG header unless the test explicitly
    # supplies already-prefixed content.
    body = content if content.startswith(PNG_HEADER) else _png(content)
    response = client.post(
        f"/api/records/{record_id}/documents/upload",
        headers=auth_headers,
        data={"document_type": document_type},
        files={"file": (filename, body, "image/png")},
    )
    assert response.status_code == 201, response.text
    return response.json()


def _local_path(db_session, document_id: int):
    """Resolve the on-disk path for a freshly uploaded document."""
    orm_doc = db_session.get(Document, document_id)
    db_session.refresh(orm_doc)
    return evidence_storage.resolve_local_path(orm_doc.storage_uri)


# --------------------------------------------------------------------------
# A. real hashing at ingest
# --------------------------------------------------------------------------


def test_ingest_computes_sha256_and_size_from_bytes(
    client, auth_headers, db_session
):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    content = _png(b"raw-evidence-bytes-\x00\x01\x02-payload")
    expected_hash = hashlib.sha256(content).hexdigest()

    doc = _upload_bytes(client, auth_headers, record["id"], "photo_id", content)
    assert doc["size_bytes"] == len(content)
    assert doc["content_hash"] == expected_hash
    # Ingest does not set verified_content_hash.
    assert doc["verified_content_hash"] is None
    assert doc["status"] == "uploaded"


def test_ingest_persists_filename_and_mime(client, auth_headers, db_session):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    content = _png(b"hello-world")
    response = client.post(
        f"/api/records/{record['id']}/documents/upload",
        headers=auth_headers,
        data={"document_type": "photo_id", "label": "License scan"},
        files={"file": ("id-card.png", content, "image/png")},
    )
    assert response.status_code == 201, response.text
    doc = response.json()
    assert doc["original_filename"] == "id-card.png"
    assert doc["mime_type"] == "image/png"
    assert doc["label"] == "License scan"


def test_ingest_rejects_empty_payload(client, auth_headers, db_session):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    response = client.post(
        f"/api/records/{record['id']}/documents/upload",
        headers=auth_headers,
        data={"document_type": "photo_id"},
        files={"file": ("empty.bin", b"", "application/octet-stream")},
    )
    assert response.status_code == 400


def test_ingest_rejects_overlong_payload(
    client, auth_headers, db_session, monkeypatch
):
    from app.core.config import get_settings

    settings = get_settings()
    # Bigger than the head peek (32 bytes) so type detection succeeds but
    # the streaming writer still trips the size limit.
    monkeypatch.setattr(settings, "max_upload_bytes", 48, raising=False)

    record = _create_record(client, auth_headers, _workflow(db_session).id)
    response = client.post(
        f"/api/records/{record['id']}/documents/upload",
        headers=auth_headers,
        data={"document_type": "photo_id"},
        files={"file": ("big.png", PNG_HEADER + b"X" * 256, "image/png")},
    )
    assert response.status_code == 413


def test_ingest_filename_is_sanitized(client, auth_headers, db_session):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    response = client.post(
        f"/api/records/{record['id']}/documents/upload",
        headers=auth_headers,
        data={"document_type": "photo_id"},
        files={"file": ("../../etc/passwd", _png(b"safe-bytes"), "image/png")},
    )
    assert response.status_code == 201, response.text
    doc = response.json()
    assert doc["original_filename"] == "passwd"
    # Response does not expose storage_uri; resolve the ORM row directly
    # to confirm storage lives inside the configured evidence root.
    orm_doc = db_session.get(Document, doc["id"])
    db_session.refresh(orm_doc)
    assert orm_doc.storage_uri is not None
    assert orm_doc.storage_uri.startswith("file:")
    resolved = evidence_storage.resolve_local_path(orm_doc.storage_uri)
    assert resolved is not None
    assert resolved.is_file()


# --------------------------------------------------------------------------
# B. verification re-hashes stored bytes
# --------------------------------------------------------------------------


def test_verification_rehashes_stored_bytes_and_succeeds(
    client, auth_headers, db_session
):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    content = _png(b"stable-verification-bytes")
    expected = hashlib.sha256(content).hexdigest()
    doc = _upload_bytes(client, auth_headers, record["id"], "photo_id", content)

    verify = client.post(
        f"/api/documents/{doc['id']}/verify", headers=auth_headers, json={}
    )
    assert verify.status_code == 200, verify.text
    body = verify.json()
    assert body["status"] == "verified"
    assert body["verified_content_hash"] == expected


def test_verification_fails_when_stored_bytes_are_altered(
    client, auth_headers, db_session
):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    doc = _upload_bytes(
        client, auth_headers, record["id"], "photo_id", b"original-bytes"
    )

    # Tamper with the stored file on disk.
    path = _local_path(db_session, doc["id"])
    assert path is not None
    path.write_bytes(b"tampered-bytes")

    verify = client.post(
        f"/api/documents/{doc['id']}/verify", headers=auth_headers, json={}
    )
    assert verify.status_code == 409
    # The row must not be left in a VERIFIED state.
    fresh = db_session.get(Document, doc["id"])
    db_session.refresh(fresh)
    assert fresh.status.value == "rejected"
    assert fresh.verified_content_hash is None
    assert fresh.rejection_reason and "integrity mismatch" in fresh.rejection_reason.lower()


def test_verification_fails_when_stored_content_is_missing(
    client, auth_headers, db_session
):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    doc = _upload_bytes(client, auth_headers, record["id"], "photo_id", b"gone-soon")

    path = _local_path(db_session, doc["id"])
    assert path is not None
    path.unlink()

    verify = client.post(
        f"/api/documents/{doc['id']}/verify", headers=auth_headers, json={}
    )
    assert verify.status_code == 400


def test_verification_fails_for_metadata_only_document(
    client, auth_headers, db_session
):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    # Register via the legacy JSON path (no bytes).
    doc = client.post(
        f"/api/records/{record['id']}/documents",
        headers=auth_headers,
        json={"document_type": "photo_id"},
    ).json()

    verify = client.post(
        f"/api/documents/{doc['id']}/verify", headers=auth_headers, json={}
    )
    assert verify.status_code == 400


# --------------------------------------------------------------------------
# C. integrity-check endpoint
# --------------------------------------------------------------------------


def test_integrity_check_returns_match_for_untouched_bytes(
    client, auth_headers, db_session
):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    content = _png(b"integrity-happy-path")
    expected = hashlib.sha256(content).hexdigest()
    doc = _upload_bytes(client, auth_headers, record["id"], "photo_id", content)

    response = client.post(
        f"/api/documents/{doc['id']}/integrity-check", headers=auth_headers
    )
    assert response.status_code == 200
    body = response.json()
    assert body["is_match"] is True
    assert body["has_stored_content"] is True
    assert body["expected_content_hash"] == expected
    assert body["actual_content_hash"] == expected


def test_integrity_check_detects_tampering(client, auth_headers, db_session):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    doc = _upload_bytes(
        client, auth_headers, record["id"], "photo_id", b"first"
    )

    path = _local_path(db_session, doc["id"])
    assert path is not None
    path.write_bytes(b"second")

    response = client.post(
        f"/api/documents/{doc['id']}/integrity-check", headers=auth_headers
    )
    body = response.json()
    assert body["is_match"] is False
    assert body["has_stored_content"] is True
    assert body["expected_content_hash"] != body["actual_content_hash"]


def test_integrity_check_on_missing_content(client, auth_headers, db_session):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    doc = _upload_bytes(client, auth_headers, record["id"], "photo_id", b"bye")

    path = _local_path(db_session, doc["id"])
    assert path is not None
    path.unlink()

    response = client.post(
        f"/api/documents/{doc['id']}/integrity-check", headers=auth_headers
    )
    body = response.json()
    assert body["is_match"] is False
    assert body["has_stored_content"] is False


def test_integrity_check_does_not_mutate_document(
    client, auth_headers, db_session
):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    doc = _upload_bytes(
        client, auth_headers, record["id"], "photo_id", b"still-uploaded"
    )
    before_status = doc["status"]

    client.post(
        f"/api/documents/{doc['id']}/integrity-check", headers=auth_headers
    )

    refetch = client.get(
        f"/api/records/{record['id']}/documents", headers=auth_headers
    ).json()
    matching = [d for d in refetch if d["id"] == doc["id"]][0]
    assert matching["status"] == before_status
    assert matching["verified_content_hash"] is None


# --------------------------------------------------------------------------
# D. blocked transition does not mutate persisted record risk fields
# --------------------------------------------------------------------------


def test_blocked_transition_does_not_mutate_record_risk(
    client, auth_headers, db_session
):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    initial_risk = record["risk_score"]
    initial_band = record["risk_band"]
    target = _stage_id(db_session, "provider_triage")

    response = client.post(
        f"/api/records/{record['id']}/transition",
        headers=auth_headers,
        json={"target_stage_id": target, "expected_version": record["version"]},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is False
    # Decision still reports real risk so the caller can show it.
    assert body["decision"]["risk_score"] > 0

    # But the persisted record must be unchanged.
    refetched = client.get(
        f"/api/records/{record['id']}", headers=auth_headers
    ).json()
    assert refetched["risk_score"] == initial_risk
    assert refetched["risk_band"] == initial_band
    assert refetched["version"] == record["version"]


def test_successful_transition_applies_risk_change_atomically(
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
    response = client.post(
        f"/api/records/{record['id']}/transition",
        headers=auth_headers,
        json={"target_stage_id": target, "expected_version": record["version"]},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True

    refetched = client.get(
        f"/api/records/{record['id']}", headers=auth_headers
    ).json()
    assert refetched["risk_score"] == body["decision"]["risk_score"]
    assert refetched["risk_band"] == body["decision"]["risk_band"]
    assert refetched["version"] == record["version"] + 1


# --------------------------------------------------------------------------
# E. Alembic wiring
# --------------------------------------------------------------------------


@pytest.mark.migration
def test_alembic_env_imports_metadata():
    # Import the env module and confirm it binds to the app's metadata.
    import importlib.util

    env_path = (
        Path(__file__).resolve().parents[1] / "migrations" / "env.py"
    )
    assert env_path.is_file(), "alembic env.py must exist"

    # env.py runs migrations when imported normally because it calls
    # context.is_offline_mode() at module scope. Instead, read the file
    # and confirm it references Base.metadata and the settings URL
    # resolution, which is enough to prove the wiring.
    source = env_path.read_text(encoding="utf-8")
    assert "from app.models import Base" in source
    assert "get_settings()" in source
    assert "target_metadata = Base.metadata" in source


@pytest.mark.migration
def test_alembic_baseline_migration_loads():
    import importlib.util

    migration_path = (
        Path(__file__).resolve().parents[1]
        / "migrations"
        / "versions"
        / "0001_initial_schema.py"
    )
    assert migration_path.is_file()

    spec = importlib.util.spec_from_file_location(
        "_phase2_test_migration", migration_path
    )
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    assert hasattr(module, "upgrade")
    assert hasattr(module, "downgrade")
    assert module.revision == "0001_initial_schema"
    assert module.down_revision is None
