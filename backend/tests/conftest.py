import os
import shutil
import sys
import tempfile
from pathlib import Path

# Ensure the backend package is importable when pytest is run from any cwd.
BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

# Use an isolated SQLite database, predictable JWT secret, and a tempdir
# for local evidence storage. All three need to be set before any
# application module imports its settings.
os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("JWT_EXPIRES_MINUTES", "60")
_EVIDENCE_TMP = Path(tempfile.mkdtemp(prefix="veriflow-tests-evidence-"))
os.environ.setdefault("EVIDENCE_STORAGE_DIR", str(_EVIDENCE_TMP))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core import database as db_module
from app.core.database import get_db
from app.core.rate_limit import reset_rate_limits
from app.main import app
from app.models import Base
from app.seed.seed_data import seed


# Honor TEST_DATABASE_URL for CI matrix entries that want to exercise
# PostgreSQL. The default keeps the fast in-memory SQLite loop used
# during local development.
TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL") or "sqlite+pysqlite:///:memory:"
IS_SQLITE_MEMORY = TEST_DATABASE_URL.startswith("sqlite") and ":memory:" in TEST_DATABASE_URL


@pytest.fixture(scope="session")
def engine():
    if IS_SQLITE_MEMORY:
        engine = create_engine(
            TEST_DATABASE_URL,
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
            future=True,
        )
    else:
        engine = create_engine(TEST_DATABASE_URL, future=True, pool_pre_ping=True)
    Base.metadata.create_all(bind=engine)
    return engine


@pytest.fixture(scope="session")
def session_factory(engine):
    return sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)


@pytest.fixture(autouse=True)
def _reset_database(engine, session_factory, monkeypatch):
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    # Clear any evidence blobs persisted by the previous test so integrity
    # checks see a clean slate per test.
    if _EVIDENCE_TMP.exists():
        for entry in _EVIDENCE_TMP.iterdir():
            if entry.is_file():
                entry.unlink()

    monkeypatch.setattr(db_module, "engine", engine, raising=True)
    monkeypatch.setattr(db_module, "SessionLocal", session_factory, raising=True)

    # Each test starts with an empty rate-limit bucket so budgets from
    # one test cannot bleed into another.
    reset_rate_limits()

    with session_factory() as db:
        seed(db)

    def _override_get_db():
        db = session_factory()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _override_get_db
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def admin_token(client):
    response = client.post(
        "/api/auth/login",
        json={"email": "admin@veriflow.demo", "password": "VeriFlow!2025"},
    )
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


@pytest.fixture
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture
def db_session(session_factory):
    with session_factory() as session:
        yield session
