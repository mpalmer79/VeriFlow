# UI Elevation Review

Post-implementation review for the Phase 1–8 UI elevation. Three
sections: bundle sizes, a structural walk of the app by demo role,
and a cross-check against the discovery research in `/docs/`.

## Bundle sizes

Final `npm run build` after Phase 8 with `.next` wiped first:

| Route | Page chunk | First Load JS |
|-------|------------|---------------|
| `/` (landing) | 5.7 kB | **149 kB** |
| `/_not-found` | 873 B | 88.2 kB |
| `/dashboard` | 4.93 kB | 149 kB |
| `/enter` | 3.51 kB | 90.8 kB |
| `/login` | 5.6 kB | 132 kB |
| `/operations` | 11.6 kB | 138 kB |
| `/records` | 2.5 kB | 142 kB |
| `/records/[id]` (dynamic) | 13.1 kB | 160 kB |
| shared by all | — | 87.3 kB |

The landing page's 149 kB First Load JS is well under Phase 8's
250 kB budget. Framer Motion tree-shakes cleanly; the single
shared chunk (`chunks/117-*`) carries the motion runtime. No route
needs a dynamic import yet.

The record-detail page is the heaviest at 160 kB and is acceptable
— it is rendered on demand (`ƒ`), and it hosts every primitive:
timeline, evaluation bars, audit trail, overflow popover,
ConfirmDialog, PreviewOverlay. No single import dominates the bill.

## Structural walk by demo role

A manual browser walkthrough per demo role was not possible in the
build sandbox (Chromium download is blocked). The walk below is a
structural review — sources of truth, not screenshots. The four
demo accounts are `admin@`, `intake@`, `reviewer@`, `manager@`; the
only role-gated surface is `/operations`.

### Admin

- **Sees** dashboard, records, record detail, operations, user
  menu with Switch role (demo) + Sign out.
- **Verified paths**: KPI hero reveals via stagger; LIVE indicator
  polls on a 30s cadence and pauses when the tab is backgrounded;
  Needs attention and Records filters are keyboard + pointer
  accessible; record-detail primary actions gate correctly on
  blocking issues via `transitionBlockedReason`; operations shows
  the Link2 chain chip + animated broken-chain border when chain
  is not ok.
- **Potential issue**: `/operations` has a busy top nav (Dashboard
  / Records / Operations) — the role-admin-only Operations item
  could gain a small icon to match the dashboard aesthetic; not in
  scope for this pass.

### Intake coordinator / Reviewer / Manager

- **Sees** dashboard, records, record detail, user menu with Sign
  out (no Operations, no /roles).
- **Verified paths**: the non-admin filter in `AppShell`
  (`adminOnly`) correctly hides Operations from the nav;
  `/operations` direct-visit shows the "Admin access required"
  EmptyState rather than exposing data; every other surface is
  identical to admin.

### Common to all roles

- Landing (/) is for anonymous traffic; an authenticated visit
  redirects to /dashboard via the useEffect on `app/page.tsx`.
- `/enter` always redirects authenticated users to /dashboard;
  unauthenticated users either auto-signin (demo) or get bounced
  to /login.
- `prefers-reduced-motion: reduce` collapses every Framer Motion
  call site to an instant state change —
  `reduced-motion.spec.ts` is the regression guard.

No regressions identified in the structural review. The e2e
suite (Phase 8.1) enforces the behavioural contracts.

## Discovery doc cross-check

The `/docs/` folder holds the research that framed this project.
Mapping each document to what the elevation shipped — and flagging
where the research hints at future work that is outside this pass
but worth recording.

### `product_thesis.md`
> "Records must progress through gated stages based on verifiable
> evidence and explainable decision logic."

Every thesis plank is now visible in the UI:

| Thesis plank | UI surface |
|--------------|------------|
| Deterministic stage progression | `WorkflowTimeline` (Phase 4) |
| Evidence-backed decision gating | `DocumentEvidencePanel` + document-status chips; `DocumentRows` overflow menu (Phase 6) |
| Explainable rule evaluation | `EvaluationPanel` + `SeverityPanel` with `RuleCodeBadge`; `AuditTrail` resolves stage IDs to names and surfaces rule codes |
| Append-only audit trails | `/operations` Audit chain panel with Link2 icon + animated broken-chain border |

### `product_overview.md`
> "Block / warn / proceed ... per-record score and band ... why"

The three questions the product answers are all represented. The
evaluation panel hero bars make block vs proceed visually primary,
the risk-score bar animates between states, and the
`SeverityPanel` stacks render the "why" as a staggered reveal.

### `workflow_rules.md` + `workflow_spec.md` + `rule_specification.md`
> Nine-stage healthcare intake workflow; stage-aware rule filtering;
> risk scoring; transition enforcement.

- The 9 stages are rendered with terminal treatment (square nodes
  for Blocked / Closed) via `WorkflowTimeline`.
- Stage-aware filtering is a backend concern; the UI correctly
  shows the current stage via `aria-current="step"` and advances
  the timeline on successful transitions.
- Risk scoring thresholds (low / moderate / high / critical) drive
  color selection in `RiskBadge` and the evaluation risk-score bar,
  with tick marks at 25 / 50 / 80.
- Rule codes are exposed as `RuleCodeBadge` (copyable) in both the
  evaluation panel and the audit trail.

**Gap worth flagging**: `rule_specification.md` defines a rule
template (business intent, evidence, pass condition, explanation
template, owner). None of these are surfaced in the UI — admins
cannot browse the rule registry. A `/rules` (or admin-scoped
operations tab) surface could render the Rule rows using the same
`RuleCodeBadge` + severity icons already in place. This is a
natural extension of the Phase 7 Operations console, not in scope
for this elevation pass.

### `architecture_decisions.md`

Five ADRs; the two that touch the frontend:

- **ADR 3 — Append-only audit log.** Surfaced end-to-end:
  `/operations` Audit chain panel, record-detail `AuditTrail` with
  human-readable events, canonical payload keys resolved to labels.
- **ADR 5 — Evidence-centric design.** Surfaced end-to-end:
  `DocumentEvidencePanel`, `DocumentStatusChip` migrated to the
  `verified` / `rejected` tones (distinct from severity band
  colors), integrity results rendered inline.

### `roadmap.md`

Mapping roadmap phases to what the elevation delivered on the UI
side:

| Roadmap phase | Elevation delivery |
|---------------|--------------------|
| Phase 1 — Foundation (migrations, optimistic locking, idempotency, object storage) | Backend-scoped; UI exposes `record.version` with a tooltip that explains the optimistic concurrency semantics (Phase 6.6). |
| Phase 2 — Trust (audit log sealing, OIDC-ready, evidence verification lifecycle) | Chain-verification panel + document verify / reject / integrity-check flows with animated feedback. OIDC itself is out of frontend scope. |
| Phase 3 — Clarity (rule specification system, admin/debug UI, workflow visualization) | **Workflow visualization** delivered via rebuilt `WorkflowTimeline` (Phase 4) and the landing-page healthcare section (Phase 3). **Admin/debug UI** delivered via `/operations`. **Rule specification surfacing** NOT delivered — see gap flagged under `rule_specification.md`. |
| Phase 4 — Intelligence (analytics, process mining, KPI dashboards) | **KPI dashboards** delivered via `KPICard` hero + live polling + `Needs attention` table. **Analytics / process mining** is backend-driven; if / when the backend exposes rule-trigger frequency or stage-bottleneck metrics, the same `KPICard` + sparkline + `MotionList` primitives are ready to render them. |
| Phase 5 — Expansion (second domain) | Not in frontend scope. The `workflow_id:stage_id` resolution fix (Phase 5) and the domain-agnostic `WorkflowTimeline` keep the UI ready for it. |

### `security_privacy.md`

- **Role-based access**: enforced in `AppShell` (nav filter) and at
  the API layer. The new `UserMenu` makes role identity visible on
  every page.
- **No PII in logs**: out of frontend scope; worth noting that the
  UI does render `subject_full_name` and related fields, which is
  correct for an authenticated operator but would need attention
  if ever used in logged telemetry.

### `validation_plan.md`

Most planks are backend test territory. The frontend layer
contributes: `records.spec.ts` (records flow + timeline marker),
`confirm-dialog.spec.ts` (destructive confirmations),
`operations.spec.ts` (admin + empty state),
`typography-motion.spec.ts` (font + motion contract),
`landing.spec.ts` (anonymous flow + smooth scroll),
`dashboard.spec.ts` (KPI + LIVE + URL-synced filters),
`toasts.spec.ts` (success auto-dismiss + manual dismiss),
`reduced-motion.spec.ts` (motion-averse regression guard),
`smoke.spec.ts` (auth/shell).

### `results.md` + `deployment.md` + `build.md` + `migrations.md` + `document_evidence.md`

Operational documents rather than product direction; no UI work
implied.

## Recommendations flagged but out of scope

Thoughtful additions the discovery docs hint at, surfaced here so
they are not forgotten:

1. **Rule registry surface.** A read-only admin view of rule rows
   (code, severity, weight, description, business intent) with the
   same `RuleCodeBadge` + severity icons already in use. Needs a
   backend list endpoint to exist; fits cleanly under a second
   `/operations` tab or a new `/rules` route.
2. **Manual override with logged reason.** `workflow_spec.md` calls
   for admin overrides that record the reason. The `ConfirmDialog`
   already supports a reason input via `inputLabel`; the override
   itself is a backend policy decision.
3. **Stage-bottleneck / rule-hit analytics.** Roadmap Phase 4 hints
   at aggregate metrics. The `KPICard` + sparkline + `MotionList`
   primitives are ready; pending backend exposure.
4. **Second reference workflow.** The multi-workflow stage
   resolution (Phase 5) unblocks this — the seed would need a
   second workflow for the UI story to land.

None of these are bugs or gaps in what this elevation was scoped to
deliver; they are the natural next chapters the research points at.
