"""One-shot helper: if the running database still records the
pre-Phase-3 revision id ('0001_initial_schema'), rewrite it to the
new id ('0001_baseline').

Phase 3 of the remediation pass replaced the create_all baseline
with an explicit DDL migration and renamed the revision in the
process. Long-lived databases (production, staging) already have
the old id in alembic_version.version_num, so `alembic upgrade head`
aborts before it can even plan — the revision it sees in the DB is
not on disk any more.

This script idempotently rewrites that row. It is safe to run at
every start-up:

- If alembic_version does not exist yet, do nothing (fresh database;
  alembic upgrade head will create it).
- If the row already reads 0001_baseline or any later revision, do
  nothing.
- Only when the row literally says 0001_initial_schema do we rewrite.

Invoke before `alembic upgrade head` in the start command.
"""

from __future__ import annotations

import sys

from sqlalchemy import create_engine, inspect, text

from app.core.config import get_settings


OLD_REVISION = "0001_initial_schema"
NEW_REVISION = "0001_baseline"


def main() -> int:
    settings = get_settings()
    engine = create_engine(settings.database_url)
    try:
        inspector = inspect(engine)
        if "alembic_version" not in inspector.get_table_names():
            print("alembic_version table absent; nothing to rewrite.")
            return 0
        with engine.begin() as conn:
            current = conn.execute(
                text("SELECT version_num FROM alembic_version")
            ).scalar_one_or_none()
            if current is None:
                print("alembic_version is empty; nothing to rewrite.")
                return 0
            if current != OLD_REVISION:
                print(
                    f"alembic_version is already {current!r}; no rewrite needed."
                )
                return 0
            conn.execute(
                text(
                    "UPDATE alembic_version SET version_num = :new "
                    "WHERE version_num = :old"
                ),
                {"new": NEW_REVISION, "old": OLD_REVISION},
            )
            print(
                f"Rewrote alembic_version.version_num from "
                f"{OLD_REVISION!r} to {NEW_REVISION!r}."
            )
            return 0
    finally:
        engine.dispose()


if __name__ == "__main__":
    sys.exit(main())
