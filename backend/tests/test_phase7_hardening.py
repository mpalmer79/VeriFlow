"""Phase 7 hardening tests.

Covers:
- document_service package re-exports the same public API that the old
  module exposed (no-behavior-change refactor guard)
- Settings.refuses the default JWT_SECRET in non-dev app envs; accepts
  it under dev-like envs
- CORS config no longer advertises `*` methods/headers; the configured
  lists drive what the browser sees in preflight
- Rate limiter actually blocks bursts on `/auth/login`,
  `/documents/upload`, and `/documents/{id}/signed-access`
- CI workflow file and Dockerfiles exist and reference real commands
- Record detail record-header component file exists (sanity check for
  the extraction) and the orchestrator page imports it
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest
import yaml
from fastapi.testclient import TestClient

from app.core.rate_limit import reset_rate_limits


PNG_HEADER = b"\x89PNG\r\n\x1a\n"

REPO_ROOT = Path(__file__).resolve().parents[2]


# --------------------------------------------------------------------------
# document_service package contract
# --------------------------------------------------------------------------


def test_document_service_package_reexports_full_surface():
    from app.services import document_service

    expected = {
        "DocumentServiceError",
        "DocumentNotFound",
        "DocumentAccessDenied",
        "DocumentContentMissing",
        "DocumentIntegrityFailure",
        "DocumentStatusSummary",
        "EvidenceSummary",
        "IntegrityCheckResult",
        "check_integrity",
        "delete_document",
        "document_status",
        "evidence_summary",
        "list_for_record",
        "record_integrity_summary",
        "register_document_metadata",
        "reject_document",
        "required_document_types",
        "resolve_content_for_download",
        "upload_document",
        "upload_file_document",
        "upload_file_stream",
        "verify_document",
    }
    actual = {name for name in dir(document_service) if not name.startswith("_")}
    missing = expected - actual
    assert not missing, f"document_service lost public names: {sorted(missing)}"


def test_document_service_submodules_exist_and_import():
    import app.services.document_service as pkg

    # Package has a real file system path (not a stub) and the submodules
    # each load cleanly.
    assert hasattr(pkg, "__path__")
    from app.services.document_service import (
        cleanup,
        content,
        ingest,
        summary,
        verification,
    )

    assert ingest.upload_file_stream is not None
    assert verification.verify_document is not None
    assert content.resolve_content_for_download is not None
    assert cleanup.delete_document is not None
    assert summary.evidence_summary is not None


# --------------------------------------------------------------------------
# JWT-secret safety
# --------------------------------------------------------------------------


def test_settings_refuse_default_secret_in_production():
    from app.core.config import DEFAULT_JWT_SECRET, Settings, UnsafeConfigurationError

    with pytest.raises(UnsafeConfigurationError):
        Settings(app_env="production", jwt_secret=DEFAULT_JWT_SECRET)


def test_settings_accept_default_secret_in_dev_envs():
    from app.core.config import DEFAULT_JWT_SECRET, Settings

    for env in ("development", "dev", "test", "TESTING", "ci"):
        s = Settings(app_env=env, jwt_secret=DEFAULT_JWT_SECRET)
        assert s.jwt_secret == DEFAULT_JWT_SECRET


def test_settings_accept_real_secret_in_production():
    from app.core.config import Settings

    s = Settings(app_env="production", jwt_secret="a-very-real-secret")
    assert s.jwt_secret == "a-very-real-secret"


# --------------------------------------------------------------------------
# CORS tightening
# --------------------------------------------------------------------------


def test_cors_defaults_are_not_wildcard():
    from app.core.config import get_settings

    s = get_settings()
    assert "*" not in s.cors_allow_methods
    assert "*" not in s.cors_allow_headers
    assert "GET" in s.cors_allow_methods
    assert "POST" in s.cors_allow_methods
    assert any(h.lower() == "authorization" for h in s.cors_allow_headers)


def test_cors_preflight_advertises_configured_methods(client):
    response = client.options(
        "/api/records",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization",
        },
    )
    # Starlette returns 200 for a well-formed preflight.
    assert response.status_code == 200
    allowed = response.headers.get("access-control-allow-methods", "")
    # Configured list, not a wildcard.
    assert "*" not in allowed
    assert "GET" in allowed


# --------------------------------------------------------------------------
# Rate limiter
# --------------------------------------------------------------------------


def test_login_rate_limit_triggers(client, monkeypatch):
    from app.core.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(settings, "rate_limit_login_per_minute", 3, raising=False)
    reset_rate_limits()

    # 3 attempts within the window are tolerated; the 4th trips.
    codes = []
    for _ in range(4):
        r = client.post(
            "/api/auth/login",
            json={"email": "admin@veriflow.demo", "password": "wrong-password"},
        )
        codes.append(r.status_code)
    assert codes.count(429) >= 1


def test_upload_rate_limit_triggers(client, auth_headers, monkeypatch, db_session):
    from sqlalchemy import select

    from app.core.config import get_settings
    from app.models.workflow import Workflow

    settings = get_settings()
    monkeypatch.setattr(settings, "rate_limit_upload_per_minute", 2, raising=False)
    reset_rate_limits()

    workflow = db_session.execute(
        select(Workflow).where(Workflow.slug == "healthcare-intake")
    ).scalar_one()
    created = client.post(
        "/api/records",
        json={
            "workflow_id": workflow.id,
            "subject_full_name": "Phase 7 Subject",
            "subject_dob": "1990-01-01",
        },
        headers=auth_headers,
    ).json()

    def _upload():
        return client.post(
            f"/api/records/{created['id']}/documents/upload",
            headers=auth_headers,
            data={"document_type": "photo_id"},
            files={"file": ("x.png", PNG_HEADER + b"payload", "image/png")},
        )

    codes = [_upload().status_code for _ in range(4)]
    assert codes.count(429) >= 1


def test_signed_access_rate_limit_triggers(
    client, auth_headers, monkeypatch, db_session
):
    from sqlalchemy import select

    from app.core.config import get_settings
    from app.models.workflow import Workflow

    settings = get_settings()
    monkeypatch.setattr(
        settings, "rate_limit_signed_access_per_minute", 2, raising=False
    )
    reset_rate_limits()

    workflow = db_session.execute(
        select(Workflow).where(Workflow.slug == "healthcare-intake")
    ).scalar_one()
    created = client.post(
        "/api/records",
        json={
            "workflow_id": workflow.id,
            "subject_full_name": "Signed Phase 7",
            "subject_dob": "1990-01-01",
        },
        headers=auth_headers,
    ).json()
    upload = client.post(
        f"/api/records/{created['id']}/documents/upload",
        headers=auth_headers,
        data={"document_type": "photo_id"},
        files={"file": ("x.png", PNG_HEADER + b"payload", "image/png")},
    ).json()

    def _grant():
        return client.post(
            f"/api/documents/{upload['id']}/signed-access",
            headers=auth_headers,
            json={"disposition": "inline"},
        )

    codes = [_grant().status_code for _ in range(4)]
    assert codes.count(429) >= 1


# --------------------------------------------------------------------------
# CI + Docker artefacts exist and look plausible
# --------------------------------------------------------------------------


def test_ci_workflow_references_real_commands():
    path = REPO_ROOT / ".github" / "workflows" / "ci.yml"
    assert path.is_file(), f"missing CI workflow at {path}"
    parsed = yaml.safe_load(path.read_text(encoding="utf-8"))
    jobs = parsed["jobs"]
    for expected in ("backend-sqlite", "backend-postgres", "frontend"):
        assert expected in jobs, f"CI is missing job {expected}"

    # Spot-check that the steps invoke commands we actually expose.
    # The SQLite job is the broad feedback loop; Alembic is exercised by
    # the PostgreSQL job (Phase 9 CI split).
    backend_sqlite_cmds = " ".join(
        step.get("run", "") for step in jobs["backend-sqlite"]["steps"]
    )
    assert "pip install -r requirements.txt" in backend_sqlite_cmds
    assert "pytest" in backend_sqlite_cmds

    backend_postgres_cmds = " ".join(
        step.get("run", "") for step in jobs["backend-postgres"]["steps"]
    )
    assert "alembic upgrade head" in backend_postgres_cmds
    assert "pytest" in backend_postgres_cmds

    frontend_cmds = " ".join(
        step.get("run", "") for step in jobs["frontend"]["steps"]
    )
    assert "npm ci" in frontend_cmds
    assert "npm run type-check" in frontend_cmds
    assert "npm run build" in frontend_cmds


def test_backend_dockerfile_is_coherent():
    path = REPO_ROOT / "backend" / "Dockerfile"
    assert path.is_file()
    text = path.read_text(encoding="utf-8")
    assert "python:3.11" in text
    assert "pip install -r requirements.txt" in text
    assert "uvicorn" in text
    # Non-root user
    assert "USER veriflow" in text


def test_frontend_dockerfile_is_coherent():
    path = REPO_ROOT / "frontend" / "Dockerfile"
    assert path.is_file()
    text = path.read_text(encoding="utf-8")
    assert "node:" in text
    assert "npm ci" in text
    assert "npm run build" in text
    assert "next start" in text


def test_docker_compose_mentions_db_backend_frontend():
    path = REPO_ROOT / "docker-compose.yml"
    assert path.is_file()
    parsed = yaml.safe_load(path.read_text(encoding="utf-8"))
    services = parsed["services"]
    assert {"db", "backend", "frontend"}.issubset(services.keys())
    # Compose wires Alembic into the backend entrypoint so a fresh DB is
    # migrated before uvicorn starts.
    backend_cmd = " ".join(services["backend"].get("command", []))
    assert "alembic upgrade head" in backend_cmd


# --------------------------------------------------------------------------
# Frontend record-detail extraction sanity check
# --------------------------------------------------------------------------


def test_record_detail_page_uses_extracted_components():
    page = (
        REPO_ROOT
        / "frontend"
        / "app"
        / "(app)"
        / "records"
        / "[id]"
        / "page.tsx"
    )
    assert page.is_file()
    text = page.read_text(encoding="utf-8")
    for expected in (
        "@/components/record-detail/RecordHeader",
        "@/components/record-detail/ActionBar",
        "@/components/record-detail/EvaluationPanel",
        "@/components/record-detail/WorkflowTimeline",
        "@/components/record-detail/DocumentEvidencePanel",
        "@/components/record-detail/AuditTrail",
        "@/components/record-detail/PreviewOverlay",
    ):
        assert expected in text, f"page.tsx no longer imports {expected}"
