# VeriFlow docs index

One-line pointer into each doc under this directory. Root-level
`ARCHITECTURE.md`, `CHANGELOG.md`, and `README.md` live above this
folder.

## Product + workflow

- [`product_thesis.md`](./product_thesis.md) — the problem statement
  and the core claim the project stands on.
- [`product_overview.md`](./product_overview.md) — framing of the
  capabilities + explicit non-goals.
- [`workflow_spec.md`](./workflow_spec.md) — the reference Healthcare
  Intake workflow, its stages, and its allowed transitions.
- [`workflow_rules.md`](./workflow_rules.md) — the rule registry, rule
  metadata, evaluation flow, and transition enforcement.
- [`rule_specification.md`](./rule_specification.md) — how an
  individual rule is specified end-to-end.
- [`document_evidence.md`](./document_evidence.md) — the document
  evidence model and the hybrid rule contract.
- [`validation_plan.md`](./validation_plan.md) — the testing
  categories the suite covers.
- [`roadmap.md`](./roadmap.md) — phased capability roadmap.

## Architecture + security

- [`architecture_decisions.md`](./architecture_decisions.md) — short
  ADR summaries for every architectural choice that shapes day-to-day
  engineering.
- [`security_privacy.md`](./security_privacy.md) — identity model,
  authorization, audit, and compliance targets.
- [`migrations.md`](./migrations.md) — Alembic layout, the
  `0001_baseline.py` invariants, and the workflow for future schema
  changes.

## Frontend / UX

- [`motion.md`](./motion.md) — motion preset catalog with
  reduced-motion behaviour for each preset.
- [`ui_motion_audit.md`](./ui_motion_audit.md) — per-file inventory
  of every Framer Motion call site + the three gradient uses.
- [`ui_elevation_baseline.md`](./ui_elevation_baseline.md) — the
  pre-elevation baseline + per-phase completion record for the UI
  elevation pass.
- [`ui_elevation_review.md`](./ui_elevation_review.md) — bundle
  sizes, structural walk per demo role, and a cross-check of the
  research docs against what shipped.

## Operations

- [`build.md`](./build.md) — the multi-phase UI elevation plan that
  drove Phases 1–8 of the frontend work (historical).
- [`deployment.md`](./deployment.md) — Railway wiring and the
  release workflow.
- [`results.md`](./results.md) — notes on specific incidents and
  their fixes (historical).
