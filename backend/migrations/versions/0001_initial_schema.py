"""Initial schema baseline (Phases 0-2).

This migration is the first Alembic revision for VeriFlow. Before this
revision the repo evolved its schema via `Base.metadata.create_all` for
the local demo and the test suite. To avoid rebuilding the existing
Python models into verbose `op.create_table` calls (and drifting from
them over time), this baseline simply calls `create_all` / `drop_all`
against the current declarative metadata.

Every future schema change should be a proper incremental migration
(`op.add_column`, `op.alter_column`, etc.) built on top of this
baseline.

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-04-19

"""

from typing import Sequence, Union

from alembic import op

from app.models import Base


revision: str = "0001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    Base.metadata.create_all(bind=op.get_bind())


def downgrade() -> None:
    Base.metadata.drop_all(bind=op.get_bind())
