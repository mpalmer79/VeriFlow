"""Phase 9 hardening tests.

Covers the optimization / completion pass:

- pytest markers `postgres` and `migration` are registered and wire to
  the expected tests
- CI workflow scopes each backend job correctly (broad SQLite, narrow
  PostgreSQL + migration round-trip)
- Railway configs for backend and frontend expose the endpoints the
  docs claim
- Deployment docs separate automated steps from manual ones
- Playwright suite has the real flow specs Phase 9 added
- Restrained UX refinements on the operations page are in place
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Iterable

import pytest
import yaml


REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND = REPO_ROOT / "backend"
FRONTEND = REPO_ROOT / "frontend"
DOCS = REPO_ROOT / "docs"


# --------------------------------------------------------------------------
# pytest markers + classification
# --------------------------------------------------------------------------


def test_pytest_ini_registers_phase9_markers():
    text = (BACKEND / "pytest.ini").read_text(encoding="utf-8")
    assert "markers" in text
    # The two markers that the Phase 9 CI split relies on.
    assert "postgres:" in text
    assert "migration:" in text
    # --strict-markers keeps a typo from silently selecting nothing.
    assert "--strict-markers" in text


def _collect_marked(markers: Iterable[str]) -> set[str]:
    """Return the set of test node ids selected by `-m "<markers>"`.
    Executed via `pytest --collect-only -q` in-process so the test is
    honest about what CI will pick up.
    """
    import subprocess

    expr = " or ".join(markers)
    # Override addopts to drop pytest.ini's `-q` behavior that would
    # otherwise collapse --collect-only output to a per-file count. Keep
    # --strict-markers so a typo'd expression fails loudly.
    result = subprocess.run(
        [
            "python",
            "-m",
            "pytest",
            "--collect-only",
            "-q",
            "-o",
            "addopts=--strict-markers",
            "-m",
            expr,
        ],
        cwd=str(BACKEND),
        capture_output=True,
        text=True,
        check=True,
    )
    return {
        line.strip()
        for line in result.stdout.splitlines()
        if line.strip().startswith("tests/") and "::" in line
    }


def test_postgres_marker_selects_dialect_sensitive_tests():
    selected = _collect_marked(["postgres"])
    # DocumentRequirement partial unique indexes.
    assert any(
        "test_duplicate_global_document_requirement_is_rejected" in node
        for node in selected
    )
    assert any(
        "test_duplicate_stage_specific_requirement_is_rejected" in node
        for node in selected
    )
    # Rule-code uniqueness surfaces IntegrityError via the dialect.
    assert any(
        "test_rule_code_unique_within_same_workflow" in node for node in selected
    )


def test_migration_marker_selects_alembic_tests():
    selected = _collect_marked(["migration"])
    assert any("test_alembic_env_imports_metadata" in node for node in selected)
    assert any("test_alembic_baseline_migration_loads" in node for node in selected)


def test_broad_sqlite_set_does_not_shrink_unexpectedly():
    """Guardrail: the SQLite CI job should still run the overwhelming
    majority of tests. If this threshold trips, something got silently
    tagged `postgres` without justification."""
    selected = _collect_marked(["not postgres"])
    assert len(selected) > 150, (
        f"SQLite broad suite unexpectedly small ({len(selected)}); "
        "check for incorrectly-marked tests."
    )


# --------------------------------------------------------------------------
# CI workflow shape
# --------------------------------------------------------------------------


def _load_ci():
    return yaml.safe_load(
        (REPO_ROOT / ".github" / "workflows" / "ci.yml").read_text(encoding="utf-8")
    )


def test_ci_backend_sqlite_runs_broad_suite_only():
    jobs = _load_ci()["jobs"]
    job = jobs["backend-sqlite"]
    cmds = " ".join(step.get("run", "") for step in job["steps"])
    # Broad SQLite job: runs pytest but excludes postgres-marked tests.
    assert "pytest" in cmds
    assert 'not postgres' in cmds
    # Migrations are exercised in the postgres job; the sqlite job does
    # not need its own alembic step any more.
    assert "alembic upgrade head" not in cmds


def test_ci_backend_postgres_runs_targeted_subset_and_migration_roundtrip():
    jobs = _load_ci()["jobs"]
    job = jobs["backend-postgres"]
    cmds = " ".join(step.get("run", "") for step in job["steps"])
    # Narrow subset selected by markers.
    assert "pytest" in cmds
    assert 'postgres or migration' in cmds
    # Full migration round-trip.
    assert "alembic upgrade head" in cmds
    assert "alembic downgrade base" in cmds


def test_ci_uses_postgres_service_container():
    jobs = _load_ci()["jobs"]
    services = jobs["backend-postgres"].get("services", {})
    assert "postgres" in services
    assert services["postgres"]["image"].startswith("postgres:")


# --------------------------------------------------------------------------
# Railway config completeness
# --------------------------------------------------------------------------


def test_backend_railway_config_exposes_readiness_healthcheck():
    cfg = json.loads((BACKEND / "railway.json").read_text(encoding="utf-8"))
    assert cfg["build"]["builder"] == "DOCKERFILE"
    assert cfg["deploy"]["healthcheckPath"] == "/health/readiness"
    assert "alembic upgrade head" in cfg["deploy"]["startCommand"]
    assert cfg["deploy"]["restartPolicyType"] == "ON_FAILURE"
    # Bounded retries avoid a crash-looping revision masking the
    # previous healthy one forever.
    assert cfg["deploy"]["restartPolicyMaxRetries"] >= 1


def test_frontend_railway_config_has_healthcheck_and_restart_budget():
    cfg = json.loads((FRONTEND / "railway.json").read_text(encoding="utf-8"))
    assert cfg["build"]["builder"] == "DOCKERFILE"
    assert "next start" in cfg["deploy"]["startCommand"]
    # Healthcheck points at a route the container can serve without
    # backend connectivity, so "frontend up" is an honest signal.
    assert cfg["deploy"]["healthcheckPath"].startswith("/")
    assert cfg["deploy"]["restartPolicyType"] == "ON_FAILURE"


# --------------------------------------------------------------------------
# Deployment docs: automated vs manual clarity
# --------------------------------------------------------------------------


def test_deployment_docs_cover_automated_and_manual_split():
    text = (DOCS / "deployment.md").read_text(encoding="utf-8")
    assert "automated" in text.lower()
    assert "manual" in text.lower()
    assert "alembic upgrade head" in text
    assert "/health/readiness" in text
    assert "VERIFLOW_ALLOW_SEED" in text
    assert "NEXT_PUBLIC_API_BASE_URL" in text
    # The ephemeral-filesystem caveat must remain prominent.
    assert "volume" in text.lower()


# --------------------------------------------------------------------------
# Playwright surface
# --------------------------------------------------------------------------


def test_playwright_has_real_flow_specs():
    e2e = FRONTEND / "tests" / "e2e"
    assert (e2e / "fixtures.ts").is_file()
    # Real flows, not just a smoke login.
    assert (e2e / "records.spec.ts").is_file()
    assert (e2e / "operations.spec.ts").is_file()

    smoke = (e2e / "smoke.spec.ts").read_text(encoding="utf-8")
    assert "reviewer" in smoke.lower()  # role-gated nav coverage

    records = (e2e / "records.spec.ts").read_text(encoding="utf-8")
    assert "Document evidence" in records
    assert "Metadata only" in records

    ops = (e2e / "operations.spec.ts").read_text(encoding="utf-8")
    assert "Audit chain" in ops
    assert "Storage inventory" in ops
    assert "Orphan cleanup" in ops


# --------------------------------------------------------------------------
# Restrained UX refinement on the operations page
# --------------------------------------------------------------------------


def test_operations_page_captures_completed_at_and_routes_status_via_toasts():
    path = FRONTEND / "app" / "(app)" / "operations" / "page.tsx"
    text = path.read_text(encoding="utf-8")
    # Timestamp captured at completion, not recomputed on render.
    assert "completedAt" in text
    # Status messaging goes through the shared toast stack; the
    # auto-dismiss timer lives inside Toast.tsx rather than every page
    # reimplementing setTimeout.
    assert "useToast" in text
    assert "toast.push" in text
    # Empty state guidance before the first run.
    assert "No cleanup has run yet" in text


def test_record_detail_emits_status_via_toasts():
    # The UI elevation pass replaced the record-detail inline-flash
    # surface with toasts (shared stack at the (app) layout, own
    # auto-dismiss). The record-detail page must route success, info,
    # and error status through useToast so the experience matches the
    # rest of the app.
    path = FRONTEND / "app" / "(app)" / "records" / "[id]" / "page.tsx"
    text = path.read_text(encoding="utf-8")
    assert "useToast" in text
    assert "toast.push" in text

    toast = (FRONTEND / "components" / "ui" / "Toast.tsx").read_text(
        encoding="utf-8"
    )
    # Toast provider owns the auto-dismiss for non-error notifications.
    assert "setTimeout" in toast
    assert 'kind === "error"' in toast
