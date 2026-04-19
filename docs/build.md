Perform a targeted cleanup and hardening pass for VeriFlow before any major frontend/UI work. Do not broaden scope. This is not a new feature phase. This is a focused engineering-quality pass to fix schema edge cases, clean portfolio-facing repo quality, and tighten documentation.

Project reminder:
VeriFlow is a workflow intelligence platform that enforces process compliance, detects operational risk, and explains why a record is blocked, warned, or ready to proceed. The first scenario is a healthcare intake and compliance workflow. This is not an EHR, scheduling system, or CRM clone.

Current repo status:
- Phase 0 and Phase 1 implemented
- Phase 2 implemented: rule registry, risk scoring, evaluation, transition enforcement
- Phase 3 implemented: document evidence, document requirements, stage-aware rule filtering, structured audit payload helpers
- The backend is now credible and should be hardened before significant UI work

This cleanup pass must focus on the following.

1. Fix DocumentRequirement uniqueness with nullable stage_id

Current problem:
The uniqueness strategy on DocumentRequirement is unsafe if it relies on a standard unique constraint over:
- workflow_id
- stage_id
- document_type

Because stage_id is nullable, PostgreSQL can allow multiple rows with the same workflow_id + document_type where stage_id is NULL.

Required fix:
Implement a correct uniqueness strategy for both:
- workflow-wide requirements where stage_id IS NULL
- stage-specific requirements where stage_id IS NOT NULL

Acceptable solutions:
- partial unique indexes
- or a combination of database constraints plus service-layer enforcement
- but the final design must be reliable in PostgreSQL

Expected behavior:
- only one workflow-wide requirement per workflow + document_type
- only one stage-specific requirement per workflow + stage + document_type
- duplicates are rejected clearly

Also add tests for this behavior.

2. Tighten document requirement and document status semantics

Review current logic for:
- required
- present
- verified
- missing
- rejected

Clarify and standardize the intended behavior.

Required outcomes:
- document status computation should be explicit and predictable
- docs and code should agree on whether rejected documents count as “present” only historically, or as not satisfying the requirement
- the API response should clearly distinguish:
  - present documents
  - requirement satisfied
  - rejected documents
  - missing required documents

If current naming or structure is ambiguous, improve it with minimal breaking change.

3. Reduce portfolio clutter in the repo root and docs

Audit these files if present:
- CLAUDE.md
- docs/build.md
- docs/results.md
- any prompt-history or process-noise files

Goal:
Keep the repository clean and portfolio-facing.

Required behavior:
- remove files that are process artifacts or model-specific noise
- keep files that genuinely improve understanding of the project
- do not remove useful architecture/product docs
- do not remove anything necessary for build or setup

If a file is worth keeping but poorly named or placed, move it or rename it appropriately.

4. Improve README professionalism and demo credential handling

Current issue:
Demo credentials may be presented too casually.

Required improvement:
- keep the repo easy to run locally
- but present demo credentials in a more intentional and professional way

Good outcome examples:
- clearly labeled “local demo seed accounts”
- move the password mention to a dedicated “Local Demo Access” section
- avoid making the repo feel sloppy or insecure

Also review README for:
- clarity
- concision
- recruiter-friendly project framing
- removal of unnecessary noise

Do not rewrite the README into marketing fluff. Keep it technical and credible.

5. Tighten ARCHITECTURE.md and supporting docs

Update documentation so it better reflects the actual current design.

Required additions or refinements:
- explain document evidence model clearly
- explain document requirement uniqueness approach
- explain stage-aware rule filtering
- explain current-state RuleEvaluation persistence vs append-only audit history
- explain structured audit payload intent and examples
- explain known tradeoffs, such as:
  - hybrid use of record flags and document evidence
  - why a full no-code rule engine is intentionally deferred

Do not write generic filler. Write documentation that would be useful to an engineer reviewing the repo.

6. Add tests for cleanup/hardening behavior

Add meaningful tests for:
- duplicate global document requirement is rejected
- duplicate stage-specific document requirement is rejected
- global and stage-specific requirement combinations behave as intended
- rejected required document does not satisfy a requirement
- verified required document does satisfy a requirement
- document status response remains consistent after verify/reject changes

If service-layer enforcement is used anywhere instead of pure DB enforcement, test that path explicitly.

7. Do not expand scope

Explicitly do not:
- build major frontend pages
- add analytics dashboards
- add AI/copilot features
- redesign the whole data model
- introduce background jobs or queues
- implement a visual admin builder
- refactor unrelated files just for style

Keep this pass surgical and intentional.

8. Deliverables

At the end of this task, provide:
- updated schema/model changes if needed
- updated service logic
- updated tests
- cleaned repo structure
- improved README and ARCHITECTURE.md
- brief summary of:
  - what was cleaned up
  - what schema issue was fixed
  - what files were removed, moved, or retained and why
  - any remaining known limitations before frontend work

Acceptance criteria:
- DocumentRequirement uniqueness is reliable in PostgreSQL
- document status semantics are explicit and test-covered
- repo looks cleaner and more portfolio-ready
- README and architecture docs read like a serious engineering project
- tests pass
