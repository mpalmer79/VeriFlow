# VeriFlow — Product Overview

## Problem

Compliance-heavy operations rarely fail because a step is missing — they
fail because nobody can tell, in the moment, *what* is missing or *why* a
record is stuck. Existing tools fall into two camps:

- **Trackers and CRMs** show where a record is, but not whether it should be
  allowed to move forward. They surface state, not policy.
- **Rules engines and BPM platforms** can encode policy, but they tend to be
  opaque, slow to change, and disconnected from the day-to-day record view.

The result is operational drift: rules live in spreadsheets and tribal
knowledge, exceptions accumulate, and risk is only visible after something
goes wrong.

## Solution

VeriFlow is a workflow intelligence platform. It treats every record as a
moving object whose state is continuously evaluated against named, versioned
rules. At every transition, the system answers three questions:

1. **Is this record allowed to advance?** — block / warn / proceed
2. **What is the current risk?** — a per-record score and band
3. **Why?** — human-readable explanations tied to specific rules

These answers are surfaced inline with the record, persisted to an audit
log, and made available to downstream systems through a stable API.

## Key capabilities

- **Stage-aware workflows.** Records progress through an ordered set of
  stages with explicit terminal states. The engine knows what stage a record
  is in, what stages are reachable, and what each transition requires.
- **Rule evaluation with explanations.** Every rule emits a structured
  outcome — triggered or not, with a reason — instead of a silent boolean.
- **Risk scoring.** Triggered rules contribute weighted risk; the
  per-record score is bucketed into a risk band for prioritization.
- **Role-based access.** Admin, intake coordinator, reviewer, and manager
  roles map to the operational responsibilities of a typical compliance
  workflow.
- **Audit trail.** Mutations, transitions, and rule outcomes are recorded
  append-only and tied to the acting user.
- **Domain-agnostic core.** The first reference scenario is a healthcare
  intake workflow, but the engine is designed to host loan intake, vendor
  onboarding, claims triage, and similar workflows without a rewrite.

## What VeriFlow is not

- Not an EHR, scheduling system, or clinical decision-support tool.
- Not a CRM or generic task tracker.
- Not a low-code rule builder. Rules are code-driven during the early
  phases; a runtime DSL or visual builder is explicitly out of scope until
  the engine has proven itself against real scenarios.
