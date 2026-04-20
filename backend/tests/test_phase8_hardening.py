"""Phase 8 hardening tests.

Covers the productization / deployment-readiness pass:

- `/health` (liveness) and `/health/readiness` (DB-ping) endpoints return
  the expected shape and status codes, and readiness reports 503 when
  the DB is unreachable.
- `seed_data.run()` refuses to execute outside dev-like environments
  without the explicit `VERIFLOW_ALLOW_SEED` override.
- Frontend Phase 8 artefacts are present: `ConfirmDialog` component,
  `/operations` admin page, and the operations nav item guarded by
  `adminOnly`.
- Railway configs for backend and frontend exist and point at their
  respective Dockerfiles, and the backend healthcheck path matches the
  new readiness endpoint.
- Playwright groundwork is present: `playwright.config.ts`, a sample
  spec, and the test-focused npm scripts.
- Deployment docs exist and reference the Railway wiring.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parents[2]
FRONTEND = REPO_ROOT / "frontend"
BACKEND = REPO_ROOT / "backend"
DOCS = REPO_ROOT / "docs"


# --------------------------------------------------------------------------
# Health + readiness endpoints
# --------------------------------------------------------------------------


def test_health_endpoint_is_liveness_only(client):
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"]
    assert body["version"]


def test_readiness_endpoint_reports_database_ok(client):
    response = client.get("/health/readiness")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ready"
    assert body["database"] == "ok"
    assert body["service"]
    assert body["version"]


def test_readiness_endpoint_reports_503_when_database_unavailable(
    client, monkeypatch
):
    from sqlalchemy.exc import OperationalError

    from app.core import database as db_module

    class _BrokenEngine:
        def connect(self):
            raise OperationalError("SELECT 1", {}, Exception("down"))

    monkeypatch.setattr(db_module, "engine", _BrokenEngine(), raising=True)

    response = client.get("/health/readiness")
    assert response.status_code == 503
    body = response.json()
    assert body["status"] == "unavailable"
    assert body["database"] == "unreachable"


# --------------------------------------------------------------------------
# Seed gating
# --------------------------------------------------------------------------


def test_seed_run_refuses_in_non_dev_without_override(monkeypatch):
    from app.core.config import Settings
    from app.seed import seed_data as module
    from app.seed.seed_data import SeedNotAllowedError

    prod_settings = Settings(app_env="production", jwt_secret="real-secret")
    monkeypatch.setattr(module, "get_settings", lambda: prod_settings)
    monkeypatch.delenv("VERIFLOW_ALLOW_SEED", raising=False)

    with pytest.raises(SeedNotAllowedError):
        module.run()


def test_seed_run_allowed_via_explicit_override(monkeypatch):
    from app.core.config import Settings
    from app.seed import seed_data as module

    prod_settings = Settings(app_env="production", jwt_secret="real-secret")
    monkeypatch.setattr(module, "get_settings", lambda: prod_settings)
    monkeypatch.setenv("VERIFLOW_ALLOW_SEED", "true")

    called = {"ran": False}

    def _fake_seed(db):
        called["ran"] = True

    # Short-circuit the real seed so this test doesn't touch DB state.
    monkeypatch.setattr(module, "seed", _fake_seed)
    monkeypatch.setattr(module.Base.metadata, "create_all", lambda bind: None)

    module.run()
    assert called["ran"] is True


def test_seed_run_allowed_in_dev_env(monkeypatch):
    from app.core.config import Settings
    from app.seed import seed_data as module

    dev_settings = Settings(app_env="development")
    monkeypatch.setattr(module, "get_settings", lambda: dev_settings)
    monkeypatch.delenv("VERIFLOW_ALLOW_SEED", raising=False)

    called = {"ran": False}

    def _fake_seed(db):
        called["ran"] = True

    monkeypatch.setattr(module, "seed", _fake_seed)
    monkeypatch.setattr(module.Base.metadata, "create_all", lambda bind: None)

    module.run()
    assert called["ran"] is True


# --------------------------------------------------------------------------
# Frontend Phase 8 artefacts
# --------------------------------------------------------------------------


def test_confirm_dialog_component_exists():
    path = FRONTEND / "components" / "ConfirmDialog.tsx"
    assert path.is_file()
    text = path.read_text(encoding="utf-8")
    # Accessible dialog semantics
    assert 'role="alertdialog"' in text
    assert 'aria-modal="true"' in text
    # Focus trap + Escape handling
    assert "Escape" in text
    assert "Tab" in text


def test_operations_admin_page_exists_and_is_admin_gated():
    path = FRONTEND / "app" / "(app)" / "operations" / "page.tsx"
    assert path.is_file()
    text = path.read_text(encoding="utf-8")
    # Role check for admin
    assert 'user.role === "admin"' in text or "user?.role === \"admin\"" in text
    # Wires the three admin backend endpoints
    assert "audit.verifyChain" in text
    assert "audit.storageInventory" in text
    assert "audit.storageCleanup" in text
    # Uses the shared confirm dialog for the destructive action
    assert "ConfirmDialog" in text


def test_appshell_includes_admin_only_operations_link():
    path = FRONTEND / "components" / "AppShell.tsx"
    assert path.is_file()
    text = path.read_text(encoding="utf-8")
    assert "/operations" in text
    assert "adminOnly" in text


def test_api_client_exposes_audit_admin_helpers():
    path = FRONTEND / "lib" / "api.ts"
    assert path.is_file()
    text = path.read_text(encoding="utf-8")
    assert "verifyChain" in text
    assert "storageInventory" in text
    assert "storageCleanup" in text


# --------------------------------------------------------------------------
# Railway configs
# --------------------------------------------------------------------------


def test_backend_railway_config_is_coherent():
    path = BACKEND / "railway.json"
    assert path.is_file()
    parsed = json.loads(path.read_text(encoding="utf-8"))
    assert parsed["build"]["builder"] == "DOCKERFILE"
    assert parsed["build"]["dockerfilePath"] == "Dockerfile"
    # Readiness endpoint is what keeps Railway from routing to a node
    # with a broken DB.
    assert parsed["deploy"]["healthcheckPath"] == "/health/readiness"
    # Migrations run before uvicorn binds.
    assert "alembic upgrade head" in parsed["deploy"]["startCommand"]
    assert "uvicorn" in parsed["deploy"]["startCommand"]


def test_frontend_railway_config_is_coherent():
    path = FRONTEND / "railway.json"
    assert path.is_file()
    parsed = json.loads(path.read_text(encoding="utf-8"))
    assert parsed["build"]["builder"] == "DOCKERFILE"
    assert "next start" in parsed["deploy"]["startCommand"]


# --------------------------------------------------------------------------
# Playwright groundwork
# --------------------------------------------------------------------------


def test_playwright_scaffolding_exists():
    config = FRONTEND / "playwright.config.ts"
    smoke = FRONTEND / "tests" / "e2e" / "smoke.spec.ts"
    readme = FRONTEND / "tests" / "e2e" / "README.md"
    assert config.is_file()
    assert smoke.is_file()
    assert readme.is_file()


def test_package_json_registers_playwright_scripts():
    path = FRONTEND / "package.json"
    parsed = json.loads(path.read_text(encoding="utf-8"))
    scripts = parsed.get("scripts", {})
    assert "test:e2e" in scripts
    assert "test:e2e:install" in scripts
    dev_deps = parsed.get("devDependencies", {})
    assert "@playwright/test" in dev_deps


# --------------------------------------------------------------------------
# Deployment docs
# --------------------------------------------------------------------------


def test_deployment_docs_cover_railway():
    path = DOCS / "deployment.md"
    assert path.is_file()
    text = path.read_text(encoding="utf-8")
    assert "Railway" in text
    assert "/health/readiness" in text
    assert "EVIDENCE_STORAGE_DIR" in text
    assert "APP_ENV" in text
    assert "VERIFLOW_ALLOW_SEED" in text
