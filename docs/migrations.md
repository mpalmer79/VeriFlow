# VeriFlow — Schema evolution

Schema evolution is managed by **Alembic**, rooted at
`backend/migrations/`. As of Phase 3 the baseline is a real DDL
migration: every table, column, constraint, index, and enum is
explicit so the schema is properly versioned and replayable against
both SQLite (tests + local) and PostgreSQL (CI + production).

## Layout

```
backend/
├── alembic.ini
└── migrations/
    ├── env.py               # wires Alembic to app.models.Base.metadata
    ├── script.py.mako       # revision template
    └── versions/
        └── 0001_baseline.py
```

`env.py` resolves the database URL from
`app.core.config.Settings`, so `alembic` commands respect whatever
`DATABASE_URL` the rest of the app uses.

## Baseline strategy

`0001_baseline.py` emits explicit DDL for every table in the models.
It carries these invariants so a reviewer can confirm them at a
glance:

- `uq_rule_workflow_code` on `rules (workflow_id, code)`
- Two partial unique indexes on `document_requirements`
  (`uq_doc_req_workflow_global_type`,
  `uq_doc_req_workflow_stage_type`) with both
  `postgresql_where` and `sqlite_where` so neither dialect permits
  duplicate workflow-global rows
- Native enum types for every enum in `app.models.enums`
- `ix_audit_logs_org_id` composite (organization_id, id) added in
  Phase 2 to accelerate `_latest_hash_in_scope` writes and
  `verify_chain` scans

`create_all` is **not** used in production. It remains in
`backend/tests/conftest.py` only so the unit-test suite stays fast
against an in-memory SQLite database. Production and long-lived
development databases must go through Alembic.

## Workflow for schema changes

```bash
# From backend/ with Python env active and DATABASE_URL set:
alembic revision --autogenerate -m "add some column"
```

Then:

1. **Review the generated file by hand.** Autogenerate misses things
   — partial `where` predicates, enum name collisions, column
   defaults, server-side defaults, constraint ordering. Treat the
   output as a starting point, never as final.
2. Apply it locally and confirm both directions:
   ```bash
   alembic upgrade head
   alembic downgrade -1
   alembic upgrade head
   ```
3. Add a test if the change is risky. `backend/tests/test_migrations.py`
   is the smoke test for the baseline; targeted column-change
   migrations deserve their own focused spec.
4. Commit the migration alongside the model change in one revision.
   Do **not** let model and migration land in separate PRs.

## Common commands

```bash
alembic upgrade head                   # apply all migrations
alembic current                         # show current revision
alembic history                         # show revision chain
alembic revision -m "message"           # empty migration
alembic revision --autogenerate -m "…"  # autogenerate from metadata diff
alembic downgrade -1                    # roll back one revision
alembic stamp head                      # record head without running DDL
```

## Stamping a legacy database

If you have a VeriFlow schema in a database that predates this
baseline (created by the earlier `create_all` bootstrap):

```bash
alembic stamp 0001_baseline
```

That records the revision without re-running DDL, and subsequent
incremental migrations stack on top as normal.

## Tests vs Alembic

The pytest suite (`backend/conftest.py`) uses `Base.metadata.create_all`
on an in-memory SQLite database per session so tests are fast and
isolated. Migration smoke tests (`tests/test_migrations.py`,
`@pytest.mark.migration`) exercise the real baseline against a
temporary file-backed SQLite database; the PostgreSQL CI job runs
the same spec against a real server. Both paths share
`app.models.Base.metadata` so they cannot drift.
