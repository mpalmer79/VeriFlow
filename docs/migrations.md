# VeriFlow — Schema evolution

Schema evolution is now managed by **Alembic**, rooted at
`backend/migrations/`. The test suite still uses
`Base.metadata.create_all` against an in-memory SQLite database so
tests stay fast; production and long-lived development databases
should use Alembic.

## Layout

```
backend/
├── alembic.ini
└── migrations/
    ├── env.py               # wires Alembic to app.models.Base.metadata
    ├── script.py.mako       # revision template
    └── versions/
        └── 0001_initial_schema.py
```

`env.py` resolves the database URL from `app.core.config.Settings`, so
running Alembic commands respects the same `DATABASE_URL` the app uses.

## Baseline strategy

`0001_initial_schema.py` is an honest baseline of the current schema
(Phases 0–2). Because the project previously bootstrapped via
`Base.metadata.create_all`, the baseline migration calls the same
method against `op.get_bind()` rather than duplicating every model as
an `op.create_table` call (which would drift from the SQLAlchemy
metadata over time).

Every **future** schema change must be a proper incremental migration
built on top of this baseline — `op.add_column`, `op.alter_column`,
`op.create_index`, etc. — so we get both the "revision history"
benefit and a clear upgrade/downgrade path.

## Common commands

```bash
# From backend/ (with Python env active and DATABASE_URL set):
alembic upgrade head                 # apply all migrations
alembic current                       # show current revision
alembic history                       # show revision chain
alembic revision -m "add some column" # create a new (empty) migration
alembic revision --autogenerate -m "…" # autogenerate from metadata diff
alembic downgrade -1                  # roll back one revision
```

## Stamping an existing database

If you already have a VeriFlow schema in a database (created by an
earlier `create_all` bootstrap) and you just want Alembic to start
tracking it:

```bash
alembic stamp head
```

This records the baseline revision without running its DDL.

## Tests vs Alembic

The pytest suite (`backend/conftest.py`) deliberately calls
`Base.metadata.create_all` on an in-memory SQLite database per test so
we get fast, isolated runs without the Alembic boot time. Production
evolution goes through Alembic. The two paths share the same
`Base.metadata` so they cannot drift.

## Phase 2 additions covered by the baseline

- All Phase 0–1 tables and columns, including the Phase 1 optimistic
  concurrency (`records.version`), audit chain hashes
  (`audit_logs.previous_hash`, `audit_logs.entry_hash`), and document
  integrity metadata (`documents.original_filename`, `mime_type`,
  `size_bytes`, `content_hash`, `verified_content_hash`, `expires_at`).
- No DDL changes in Phase 2 itself — the Phase 2 work is in services,
  routes, and storage rather than schema, so the initial revision is
  the only one needed today.
