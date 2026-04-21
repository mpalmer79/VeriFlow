"""Alembic baseline migration smoke tests.

These run against a throwaway file-backed SQLite database so the full
upgrade/downgrade round-trip exercises real Alembic migration ops
(not just `Base.metadata.create_all`). The CI PostgreSQL job runs the
same spec against a live server — the marker keeps this small file
opt-in on both sides.
"""

from __future__ import annotations

import os
from pathlib import Path
from tempfile import TemporaryDirectory

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect

pytestmark = pytest.mark.migration


REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = REPO_ROOT / "backend"
ALEMBIC_INI = BACKEND_ROOT / "alembic.ini"


EXPECTED_TABLES = {
    "alembic_version",
    "organizations",
    "users",
    "workflows",
    "workflow_stages",
    "records",
    "documents",
    "document_requirements",
    "rules",
    "rule_evaluations",
    "audit_logs",
}


def _alembic_config(database_url: str) -> Config:
    """Build a config pointing Alembic at the requested URL.

    env.py asks `get_settings()` for `database_url`, and those settings
    are cached. Clearing the cache is the smallest surface change that
    lets tests target a temp SQLite file without mutating the session's
    long-lived database binding.
    """
    from app.core.config import get_settings

    cfg = Config(str(ALEMBIC_INI))
    cfg.set_main_option("sqlalchemy.url", database_url)
    os.environ["DATABASE_URL"] = database_url
    get_settings.cache_clear()
    return cfg


def test_migration_upgrades_from_empty():
    with TemporaryDirectory() as tmp:
        db_path = Path(tmp) / "baseline.db"
        url = f"sqlite:///{db_path}"
        cfg = _alembic_config(url)
        command.upgrade(cfg, "head")
        engine = create_engine(url, future=True)
        try:
            inspector = inspect(engine)
            tables = set(inspector.get_table_names())
        finally:
            engine.dispose()
        assert tables == EXPECTED_TABLES


def test_migration_downgrade_is_clean():
    with TemporaryDirectory() as tmp:
        db_path = Path(tmp) / "baseline.db"
        url = f"sqlite:///{db_path}"
        cfg = _alembic_config(url)
        command.upgrade(cfg, "head")
        command.downgrade(cfg, "base")
        engine = create_engine(url, future=True)
        try:
            inspector = inspect(engine)
            tables = set(inspector.get_table_names())
        finally:
            engine.dispose()
        # Alembic leaves its own version table after a downgrade to
        # base; every application table must be gone.
        assert tables == {"alembic_version"} or tables == set()
