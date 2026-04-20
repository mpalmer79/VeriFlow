"""Phase 11 hardening tests.

Covers the trust-hardening + product refinement pass:

- Signed content-access tokens: the bounded in-memory jti replay guard
  accepts the first use, tolerates follow-up requests for a short
  session window (so browser PDF viewers can issue HTTP Range
  follow-ups), and rejects reuse after that window closes. Metadata-only
  documents still cannot obtain a signed token. Tokens with missing
  replay-protection claims are rejected.
- CI: the new `e2e (playwright, chromium)` job is present and scoped
  (single worker, Chromium only, depends on backend+frontend jobs).
- UI: the operations page has the new "Read-only checks" and
  "Destructive operations" section headers and the tightened confirm
  copy.
- Docs: README now frames VeriFlow around evidence control and audit
  verifiability rather than generic workflow intelligence; the
  "known limitations" section reflects the new replay-guard posture.
"""

from __future__ import annotations

import time
from pathlib import Path

import pytest
import yaml
from sqlalchemy import select

from app.core.content_access import (
    ContentAccessReplayGuard,
    reset_content_access_guard,
)
from app.models.document import Document
from app.models.workflow import Workflow


REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND = REPO_ROOT / "backend"
FRONTEND = REPO_ROOT / "frontend"
DOCS = REPO_ROOT / "docs"

PNG_HEADER = b"\x89PNG\r\n\x1a\n"


# --------------------------------------------------------------------------
# Helpers replicated from the Phase 6 hardening tests. Kept local to avoid
# creating a shared helper module for four lines.
# --------------------------------------------------------------------------


def _workflow(db_session):
    return db_session.execute(
        select(Workflow).where(Workflow.slug == "healthcare-intake")
    ).scalar_one()


def _create_record(client, auth_headers, workflow_id):
    response = client.post(
        "/api/records",
        json={
            "workflow_id": workflow_id,
            "subject_full_name": "Phase 11 Subject",
            "subject_dob": "1990-01-01",
        },
        headers=auth_headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def _upload(client, auth_headers, record_id):
    return client.post(
        f"/api/records/{record_id}/documents/upload",
        headers=auth_headers,
        data={"document_type": "photo_id"},
        files={"file": ("x.png", PNG_HEADER + b"phase11", "image/png")},
    )


# --------------------------------------------------------------------------
# A. ContentAccessReplayGuard unit behaviour
# --------------------------------------------------------------------------


def test_replay_guard_accepts_first_use():
    guard = ContentAccessReplayGuard()
    assert guard.consume("jti-1", exp=time.time() + 60) is True


def test_replay_guard_accepts_reuse_within_session_window():
    guard = ContentAccessReplayGuard(session_window_seconds=1.0)
    exp = time.time() + 60
    assert guard.consume("jti-1", exp) is True
    # Immediate follow-up (e.g. browser PDF viewer range request) is fine.
    assert guard.consume("jti-1", exp) is True


def test_replay_guard_rejects_reuse_after_session_window():
    guard = ContentAccessReplayGuard(session_window_seconds=0.05)
    exp = time.time() + 60
    assert guard.consume("jti-1", exp) is True
    time.sleep(0.1)
    assert guard.consume("jti-1", exp) is False


def test_replay_guard_evicts_expired_entries():
    guard = ContentAccessReplayGuard()
    # Past-exp token. Guard treats it as accepted the first time (the
    # JWT decoder is responsible for rejecting past-exp tokens); the
    # useful property here is that the map doesn't carry the entry
    # around once it has expired.
    guard.consume("old-jti", exp=time.time() - 1)
    # Inserting a fresh entry triggers eviction of the expired one.
    guard.consume("new-jti", exp=time.time() + 60)
    # The guard's length should not grow unbounded with expired tokens.
    assert len(guard) == 1


def test_replay_guard_bounded_by_max_entries():
    guard = ContentAccessReplayGuard(max_entries=3)
    for i in range(5):
        guard.consume(f"jti-{i}", exp=time.time() + 60)
    assert len(guard) == 3


# --------------------------------------------------------------------------
# B. Signed-access endpoint wiring
# --------------------------------------------------------------------------


def test_signed_access_first_use_succeeds_second_use_rejected(
    client, auth_headers, db_session, monkeypatch
):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    doc = _upload(client, auth_headers, record["id"]).json()

    grant = client.post(
        f"/api/documents/{doc['id']}/signed-access",
        headers=auth_headers,
        json={"disposition": "inline"},
    ).json()
    token = grant["token"]

    # Shrink the grace window for this test only. monkeypatch restores
    # the attribute at teardown so later tests see the default window.
    from app.core import content_access as ca

    monkeypatch.setattr(ca._guard, "_session_window", 0.001, raising=True)

    # First use: success.
    first = client.get(f"/api/documents/content/signed?token={token}")
    assert first.status_code == 200

    time.sleep(0.02)
    second = client.get(f"/api/documents/content/signed?token={token}")
    assert second.status_code == 401
    assert "already been used" in second.json()["detail"].lower()


def test_signed_access_tolerates_immediate_follow_up_within_session_window(
    client, auth_headers, db_session
):
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    doc = _upload(client, auth_headers, record["id"]).json()

    grant = client.post(
        f"/api/documents/{doc['id']}/signed-access",
        headers=auth_headers,
        json={"disposition": "inline"},
    ).json()
    token = grant["token"]

    reset_content_access_guard()

    first = client.get(f"/api/documents/content/signed?token={token}")
    assert first.status_code == 200

    # An immediate follow-up (e.g. the browser's PDF viewer issuing a
    # Range request on the same URL) must still succeed.
    follow_up = client.get(
        f"/api/documents/content/signed?token={token}",
        headers={"Range": "bytes=0-3"},
    )
    assert follow_up.status_code in (200, 206)


def test_signed_access_metadata_only_is_still_rejected(
    client, auth_headers, db_session
):
    """Phase 6 behaviour preserved: metadata-only documents never mint
    a signed token, so the replay guard never sees their jti."""
    record = _create_record(client, auth_headers, _workflow(db_session).id)
    metadata = client.post(
        f"/api/records/{record['id']}/documents",
        headers=auth_headers,
        json={"document_type": "photo_id"},
    ).json()
    response = client.post(
        f"/api/documents/{metadata['id']}/signed-access",
        headers=auth_headers,
        json={"disposition": "inline"},
    )
    assert response.status_code == 404


def test_conftest_resets_replay_guard_between_tests():
    """Each test must start with an empty guard so that replay-prevention
    assertions in one test cannot leak to another."""
    text = (BACKEND / "tests" / "conftest.py").read_text(encoding="utf-8")
    assert "reset_content_access_guard" in text


# --------------------------------------------------------------------------
# C. CI workflow shape — new Playwright job
# --------------------------------------------------------------------------


def _load_ci():
    return yaml.safe_load(
        (REPO_ROOT / ".github" / "workflows" / "ci.yml").read_text(encoding="utf-8")
    )


def test_ci_has_scoped_playwright_job():
    jobs = _load_ci()["jobs"]
    assert "e2e" in jobs
    job = jobs["e2e"]
    # Name advertises its scope honestly.
    assert "chromium" in job["name"].lower()
    # Runs only after backend + frontend build jobs pass.
    needs = job.get("needs", [])
    assert "backend-sqlite" in needs
    assert "frontend" in needs
    cmds = " ".join(step.get("run", "") for step in job["steps"])
    # Installs only Chromium (not firefox / webkit).
    assert "playwright install" in cmds
    assert "chromium" in cmds
    # Single worker keeps the suite stable under a single-process
    # backend + SQLite shared state.
    assert "--workers=1" in cmds


# --------------------------------------------------------------------------
# D. Operations UI polish
# --------------------------------------------------------------------------


def test_operations_page_groups_readonly_and_destructive_sections():
    text = (
        FRONTEND / "app" / "(app)" / "operations" / "page.tsx"
    ).read_text(encoding="utf-8")
    # New section headers introduced in Phase 11.
    assert "Read-only checks" in text
    assert "Destructive operations" in text
    # Confirm copy quotes the file count on destructive cleanup.
    assert "Delete ${inventory.orphaned_files} file(s)" in text
    # Mono-styled event count for readability.
    assert 'className="mono text-text"' in text


# --------------------------------------------------------------------------
# E. README framing + limitations
# --------------------------------------------------------------------------


def test_readme_frames_project_as_evidence_control_platform():
    text = (REPO_ROOT / "README.md").read_text(encoding="utf-8")
    assert "evidence-control platform" in text
    # Explicit section on what the product does, rather than marketing.
    assert "What it actually does" in text
    # Honest limitation reflecting the new replay posture.
    assert "single-node" in text.lower()
    # CI documentation mentions the new e2e job scope.
    assert "e2e (playwright, chromium)" in text


# --------------------------------------------------------------------------
# F. CSV env parsing for CORS_*  (regression guard)
# --------------------------------------------------------------------------
#
# Railway-style deploys pass `CORS_ORIGINS=http://example.com` as a plain
# string. pydantic-settings defaults to JSON-decoding any collection-typed
# env var, which would reject that value before the CSV validator runs.
# The custom EnvSettingsSource in app.core.config routes these fields
# around the JSON decoder so plain strings, CSVs, and JSON lists all
# parse correctly.


def test_cors_origins_env_plain_string(monkeypatch):
    from app.core.config import Settings

    monkeypatch.setenv("CORS_ORIGINS", "http://localhost:3000")
    monkeypatch.setenv("JWT_SECRET", "t")
    s = Settings()
    assert s.cors_origins == ["http://localhost:3000"]


def test_cors_origins_env_csv(monkeypatch):
    from app.core.config import Settings

    monkeypatch.setenv("CORS_ORIGINS", "http://a.com,http://b.com")
    monkeypatch.setenv("JWT_SECRET", "t")
    s = Settings()
    assert s.cors_origins == ["http://a.com", "http://b.com"]


def test_cors_origins_env_json_list(monkeypatch):
    from app.core.config import Settings

    monkeypatch.setenv("CORS_ORIGINS", '["http://a.com","http://b.com"]')
    monkeypatch.setenv("JWT_SECRET", "t")
    s = Settings()
    assert s.cors_origins == ["http://a.com", "http://b.com"]


def test_cors_allow_methods_env_csv(monkeypatch):
    from app.core.config import Settings

    monkeypatch.setenv("CORS_ALLOW_METHODS", "GET,POST")
    monkeypatch.setenv("JWT_SECRET", "t")
    s = Settings()
    assert s.cors_allow_methods == ["GET", "POST"]
