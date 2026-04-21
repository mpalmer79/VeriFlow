# UI Elevation Baseline + Completion

This doc is the plan-of-record for the UI elevation pass executed in
Phases 1–8. Phase 0 (the pre-work audit) was deliberately skipped to
keep the elevation scoped to implementation; this doc captures the
baseline retroactively alongside the completion record so the diff
is auditable.

## Baseline (pre-elevation)

### Routes

| Path | Purpose | Top-level heading | Fetches | Gated | Known issue (pre-elevation) |
|------|---------|-------------------|---------|-------|-----------------------------|
| `/` | Redirect-only: auto-signin in demo, bounce to /login otherwise | — | no | no | No marketing / product face on the root. |
| `/login` | Sign-in form, local-demo accounts list | "Sign in to continue" | no (calls auth on submit) | redirects to / in demo | 1600 ms `animate-page-in` fade was slow and unmotivated. |
| `/dashboard` | Operations overview, four stat cards, two tables | "Operations overview" | yes | auth | Four plain StatCards, no polling, no live indicator, stage-name resolution broken across multiple workflows. |
| `/records` | Filterable record list | "Records" | yes | auth | Filters lived in useState — refresh / back button lost them. Same multi-workflow stage bug. |
| `/records/[id]` | Record detail: header, action bar, evaluation, timeline, documents, audit, preview | Subject name | yes | auth | Timeline was a flex-wrap of badges. Evaluation panel was three stat cells. Audit trail was a raw payload grid. Document rows fanned out to 6 buttons. Preview loader was a full-screen black curtain. |
| `/operations` | Admin-only audit-chain verify + storage inventory + orphan cleanup | "Operations" | yes | admin | Inline flash rendering, no icon on the chain-status chip, no animated feedback when the chain is broken. |
| `/roles` | Demo-only role switcher | "Roles" | no | demo + auth | Separate page for a dropdown-sized decision. |

### Shared components (pre-elevation)

| File | Purpose | Touched in elevation |
|------|---------|----------------------|
| `AppShell.tsx` | Authed layout, nav, header, sign-out | Yes — logomark + wordmark, UserMenu dropdown, Roles removed from nav |
| `Panel.tsx` | Standard card wrapper with title + description | No (kept for structure) |
| `StatCard.tsx` | Dashboard metric cells | Yes — icon, trend, sparkline, count-up, ok tone |
| `SeverityPanel.tsx` | Blocking / warning issue lists | Yes — icon column, RuleCodeBadge, stagger, weighted risk chip with scale pulse |
| `StatusBadge.tsx` | Record status chip | Yes — leading dot with chain-pulse on blocked |
| `DocumentStatusChip.tsx` | Document status chip | Yes — leading dot, verified/rejected color migration |
| `StageBadge.tsx` | Stage pill | No |
| `RiskBadge.tsx` | Risk band chip | No |
| `EmptyState.tsx` | Empty-state surface | Yes — optional icon, overlayFade entrance |
| `ErrorBanner.tsx` | Inline error banner | No |
| `LoadingSkeleton.tsx` | Skeleton rows | No |
| `ConfirmDialog.tsx` | Destructive confirmation modal | Yes — AnimatePresence + overlayFade/dialogPop |
| `record-detail/RecordHeader.tsx` | Subject name + meta | Yes — display-font heading, breadcrumbs, version tooltip |
| `record-detail/ActionBar.tsx` | Evaluate + transition + refresh | Yes — primary brand CTA, icon-only refresh, transitionBlockedReason |
| `record-detail/EvaluationPanel.tsx` | Decision + risk + issue lists | Yes — can-progress bar, animated risk-score bar |
| `record-detail/WorkflowTimeline.tsx` | Stage progress | Yes — complete rewrite |
| `record-detail/DocumentEvidencePanel.tsx` | Evidence grouping + upload | Yes — threaded preview-loading-doc-id through |
| `record-detail/DocumentRows.tsx` | Per-document row + actions | Yes — overflow menu with keyboard access |
| `record-detail/UploadForm.tsx` | Document upload form | No |
| `record-detail/EvidenceSummaryStrip.tsx` | Evidence summary | No |
| `record-detail/AuditTrail.tsx` | Append-only event log | Yes — icons, RuleCodeBadge, relative + absolute timestamps, raw payload toggle |
| `record-detail/PreviewOverlay.tsx` | Document preview modal | Yes — AnimatePresence + overlayFade/dialogPop |

New shared components added in the elevation: `ui/Logomark.tsx`,
`ui/AnimatedNumber.tsx`, `ui/Breadcrumbs.tsx`, `ui/KPICard.tsx`,
`ui/MotionList.tsx`, `ui/RuleCodeBadge.tsx`, `ui/Toast.tsx`,
`landing/ChainMotif.tsx`, `icons/index.ts`, `UserMenu.tsx`.

### CSS animations (pre-elevation)

All defined in `tailwind.config.ts`:

| Name | Purpose | Target state |
|------|---------|--------------|
| `fade-in` (180 ms) | Generic mount fade | Removed in Phase 1; replaced by Framer Motion entrances |
| `fade-in-slow` (300 ms) | Slower variant | Removed |
| `page-in` (1600 ms) | Login entrance | Removed; replaced by `fadeRise` + `SPRING_DEFAULT` in Phase 7 |
| `overlay-in` (160 ms) | Modal backdrop | Removed; replaced by `overlayFade` variant in Phases 6–7 |
| `dialog-in` (180 ms) | Modal dialog | Removed; replaced by `dialogPop` variant in Phases 6–7 |

One new CSS keyframe retained: `chain-pulse` (3s infinite ambient
heartbeat) used by the blocked status dot and the dashboard LIVE
pill dot.

### Known UI defects (pre-elevation)

| Defect | Files | Fixed in | Acceptance |
|--------|-------|----------|------------|
| Root is redirect-only; no product face | `app/page.tsx` | Phase 3 | `/` renders a real landing with hero / pillars / explainability / healthcare / footer |
| 1600 ms login fade feels dead | `app/login/page.tsx` | Phase 7 | `fadeRise` + `SPRING_DEFAULT` |
| Stage names wrong when records span multiple workflows | `dashboard/page.tsx`, `records/page.tsx` | Phase 5 | `lib/workflow-stages.ts` keyed on `${workflow_id}:${stage_id}` |
| Filters lost on refresh | `records/page.tsx` | Phase 5 | `useSearchParams`; survives reload |
| Timeline is a badge-chevron wrap | `WorkflowTimeline.tsx` | Phase 4 | Real node-and-line progress with animated advance |
| Evaluation panel is three equal stat cells | `EvaluationPanel.tsx` | Phase 6 | Can-progress bar + risk-score bar |
| Audit trail looks like a debug dump | `AuditTrail.tsx` | Phase 6 | Icons, RuleCodeBadge, resolved stage names, relative timestamps |
| Document row fans to 6 buttons | `DocumentRows.tsx` | Phase 6 | 4 primary + ⋯ overflow menu |
| Fullscreen preview loader | `records/[id]/page.tsx` | Phase 6 | Inline spinner on trigger |
| Roles nav entry + /roles page for a dropdown decision | `AppShell.tsx`, `app/(app)/roles/page.tsx` | Phase 7 | `UserMenu` dropdown, `/roles` deleted |

### Motion inventory (pre-elevation)

| Location | Pre-elevation | Target |
|----------|---------------|--------|
| Login page entrance | 1600 ms CSS fade (`animate-page-in`) | Framer Motion `fadeRise` + `SPRING_DEFAULT` (Phase 7) |
| `main` fade on route change | 180 ms CSS fade (`animate-fade-in`) | Retained as a cheap route primitive |
| Modal overlay / dialog | 160/180 ms CSS fades (`animate-overlay-in` / `animate-dialog-in`) | Framer Motion `overlayFade` + `dialogPop` (Phases 6–7) |
| Skeleton pulse | Tailwind default `animate-pulse` | Retained |
| Blocked status indicator | None | New `chain-pulse` CSS ambient (Phase 1+2) |
| Page entrance, section reveal, orchestrated staggers | None | Framer Motion throughout (Phases 3–6) |

## Completion

Phase-by-phase record of what shipped. Each phase landed as its own
PR and merged green.

- **Phase 1 — Design System Foundation.** Pinned `framer-motion@11.18.2`
  and `lucide-react@0.460.0`. Added brand teal ramp, verified/rejected
  colors, Fraunces display font, `chain-pulse` keyframe. Removed the
  five legacy CSS keyframes. Created `lib/motion.ts` vocabulary,
  `components/icons/index.ts` barrel, and a distinctive two-chevron
  `Logomark` that draws in once per session. Header swapped to the
  logomark + Fraunces wordmark.
- **Phase 2 — Core primitives.** Rewrote `StatCard` (icon/trend/spark/
  count-up), `SeverityPanel` (icons / `RuleCodeBadge` / stagger /
  weighted chip), `StatusBadge` and `DocumentStatusChip` (leading
  dots; blocked pulses). Added `KPICard`, `MotionList`,
  `AnimatedNumber`, `RuleCodeBadge`.
- **Phase 3 — Landing page.** Moved root demo-signin to `/enter`.
  Built a five-section landing (hero / pillars / explainability /
  healthcare / footer) with Framer Motion orchestration, the
  ambient `ChainMotif`, and a `landing.spec.ts`. Phase 3 follow-up
  added the missing hero wordmark after Playwright caught it.
- **Phase 4 — Workflow timeline rebuild.** Real node-and-line
  progress surface with horizontal / vertical responsive layout,
  animated ring scale-in on the current stage, and a connector fill
  animation on advance. `aria-current="step"` on the active stage.
  The landing page swapped its pill-row placeholder for the real
  timeline.
- **Phase 5 — Dashboard elevation.** Toast provider + `useToast`.
  Fixed multi-workflow stage resolution. KPI hero row with icons +
  stagger. 30s visibility-gated polling + LIVE/STALE pill.
  URL-synced records filters. Needs-attention table polished via
  `MotionList` + motion.tr. Record-detail inline flashes migrated
  to toasts.
- **Phase 6 — Record detail surfaces.** Breadcrumbs, Fraunces
  subject name, version tooltip, `relative-time` helper.
  Restructured ActionBar with a primary brand CTA and
  `transitionBlockedReason`. EvaluationPanel hero treatment
  (can-progress bar + animated risk-score bar + panel layout).
  AuditTrail with tone icons, stage-name resolution, RuleCodeBadge,
  raw-payload toggle. DocumentRows overflow menu with keyboard
  access. Preview inline spinner; PreviewOverlay and ConfirmDialog
  migrated to AnimatePresence + `overlayFade` / `dialogPop`.
- **Phase 7 — Roles, Operations, and small surfaces.** UserMenu
  dropdown replaces the bare sign-out button and hosts the
  role-switch submenu; `/roles` route retired. Login gains the
  short Framer Motion entrance plus an iconified demo-mode hint.
  Operations gains a `Link2` chain-status icon, a boxShadow ring
  that animates in when the chain is broken, a cleanup
  relative+absolute timestamp, and MotionList inventory stagger;
  inline flashes migrate to toasts. `EmptyState` gains an optional
  icon. Dashboard sublabels unified on verb phrases. One `…`
  escape replaced with a literal ellipsis.
- **Phase 8 — Final pass.** New Playwright specs
  (`dashboard.spec.ts`, `toasts.spec.ts`, `reduced-motion.spec.ts`)
  plus a records overflow-menu keyboard assertion. Motion audit at
  `docs/ui_motion_audit.md`. Updated README Frontend bullet. This
  baseline + completion doc.

Every phase shipped with the backend `postgres` + `sqlite` suites
green, `npm run type-check` + `npm run build` clean, and a HTTP
smoke covering the six top-level routes.
