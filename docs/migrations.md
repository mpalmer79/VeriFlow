# VeriFlow — Schema evolution

VeriFlow does not currently bundle Alembic. The local demo bootstraps
its schema via `Base.metadata.create_all` inside `seed_data.run()` and
the test suite recreates the schema per test against an in-memory
SQLite database. This keeps local development and CI friction-free.

Phase 1 hardening introduced additive columns. If you are running
against an **existing** database rather than starting fresh, you need
to evolve the schema out-of-band. This document summarizes the
columns that were added so you can craft a migration.

## Phase 1 additive changes

### `records`

- `version INTEGER NOT NULL DEFAULT 1` — optimistic-concurrency token.

### `audit_logs`

- `previous_hash VARCHAR(64) NULL` — SHA-256 hex of the chain's prior
  entry in the same organization scope.
- `entry_hash VARCHAR(64) NOT NULL` — SHA-256 hex of this entry's
  canonicalized material.
- Add a non-unique index on `entry_hash` for lookups.

Existing rows written before this change have neither hash. Running
the chain is append-from-now-on; the earliest row with a computed
`entry_hash` will simply have `previous_hash` equal to the last row's
previous hash column (or `NULL` if none existed) — the chain is only
trusted forward from the first hashed row.

### `documents`

All six columns are nullable so existing rows continue to satisfy
`NOT NULL` constraints with no backfill:

- `original_filename VARCHAR(255)`
- `mime_type VARCHAR(120)`
- `size_bytes BIGINT`
- `content_hash VARCHAR(128)` *(indexed)*
- `verified_content_hash VARCHAR(128)`
- `expires_at TIMESTAMPTZ`

## Recommended path for a real environment

For any environment that needs schema evolution beyond "drop and
recreate", introduce Alembic in a dedicated pass:

```
cd backend
pip install alembic
alembic init migrations
```

Wire `migrations/env.py` to `app.models.Base.metadata` and the
`DATABASE_URL` in settings, generate an initial "baseline" migration
that captures the current schema, then commit a second migration that
applies the Phase 1 additions above. Do not half-configure Alembic —
either do it fully in one pass or keep the current
`Base.metadata.create_all` bootstrap.

Until Alembic lands, the only supported evolution paths are:

- **Fresh databases** — `python -m app.seed.seed_data` runs
  `Base.metadata.create_all` and seeds.
- **Existing databases** — apply the column additions listed above
  manually via `ALTER TABLE` statements. Defaults and nullability are
  chosen so none of the existing rows need a backfill.
