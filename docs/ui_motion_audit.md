# VeriFlow — UI Motion Audit

An exhaustive listing of every Framer Motion call site in the
frontend, the variant or transition it uses, and the reduced-motion
behaviour we have verified for it. Grep this doc first when changing
anything that animates; add an entry when a new motion call site
lands.

## Principles

The house rules, repeated here so they are findable without leaving
this file:

- **One library.** Framer Motion is the only runtime motion library.
  Tailwind keyframes are used for one ambient perpetual loop
  (`chain-pulse`). No GSAP, React Spring, Motion One, or Auto-Animate.
- **Central vocabulary.** `frontend/lib/motion.ts` owns the durations,
  easings, springs, stagger values, and named variants. No inline
  magic numbers at call sites. Either use a named variant
  (`fadeRise`, `fadeRiseSlow`, `overlayFade`, `dialogPop`,
  `staggerParent`, `staggerParentTight`) or the `useMotionTransition`
  hook.
- **Durations.** `DURATION_MICRO = 0.12`, `DURATION_SHORT = 0.22`,
  `DURATION_MEDIUM = 0.38`, `DURATION_LONG = 0.62` (seconds). Nothing
  longer than 800ms except `chain-pulse` (3s infinite).
- **Easings.** `SPRING_DEFAULT` (stiffness 300, damping 30) for
  entrances and default layout animation. `SPRING_SOFT` (stiffness
  180, damping 26) for large-surface motion like the timeline
  advance and the risk-score bar. `EASE_OUT_EXPO = [0.22, 1, 0.36,
  1]` for reveals and fades. `EASE_OUT` (`"easeOut"` string) for
  exits.
- **Stagger.** `STAGGER_DEFAULT = 0.04` (40ms). `STAGGER_TIGHT =
  0.025` (25ms) for lists over ~10 items. Staggers go in
  `staggerChildren` on the parent's `visible` variant, never via
  `setTimeout` chains.
- **Reduced motion.** Every motion call site consults
  `useReducedMotion()` and collapses to `{ duration: 0 }` or an
  instant state change. This is non-negotiable — Tailwind's global
  reduced-motion rule does NOT cover Framer Motion because Framer
  Motion drives transforms via JS, not CSS.
- **Layout animations.** Prefer `layout` and `LayoutGroup` over
  manual transition classes whenever state causes a size or position
  change (filter re-sorts, issue list collapse, modal resize, panel
  neighbour reflow).
- **AnimatePresence hygiene.** Every `<AnimatePresence>` child has a
  `key`. `mode="wait"` only where semantically correct (true
  replacements). Modal wrappers use AnimatePresence but keep the
  existing focus-return behaviour intact.

## Motion vocabulary module

`frontend/lib/motion.ts` — duration constants, easings,
SPRING_DEFAULT, SPRING_SOFT, stagger constants, named variants
(fadeRise, fadeRiseSlow, overlayFade, dialogPop, staggerParent,
staggerParentTight), and `useMotionTransition(preset, overrides?)`.
`frontend/components/ui/AnimatedNumber.tsx` is the shared count-up
helper used by StatCard and KPICard.

## Call sites

### Landing surface

| File | Component | Purpose | Variant / transition | Reduced-motion path |
|------|-----------|---------|----------------------|---------------------|
| `app/page.tsx` | Hero cluster | Logomark + wordmark + headline + subhead + CTAs cascade on mount | `staggerParent` on parent motion.div, `fadeRise` on each child, `SPRING_DEFAULT` | Children render immediately; stagger collapses because transition.duration is 0 |
| `app/page.tsx` | CTA micro-interaction | `whileHover={{ y: -1 }}`, `whileTap={{ y: 1 }}` on primary CTA | Inline; no orchestration | Framer Motion disables `whileHover`/`whileTap` transforms when reduced-motion is set via the hover heuristic; acceptable |
| `app/page.tsx` | Section reveals | Pillars / Explainability / Healthcare / Footer reveal on scroll-into-view | `fadeRiseSlow`, `whileInView="visible"`, `viewport={{ once: true, margin: "-10%" }}`, `SPRING_DEFAULT` | Sections visible immediately |
| `app/page.tsx` | Pillar stagger | Three pillar cards stagger inside Pillars | `staggerParent` + `fadeRise` | Cards visible together |
| `components/landing/ChainMotif.tsx` | Ambient hash-chain | 5 stroked ellipses with infinite `pathLength` and opacity cycle | Staggered `delay: i * 0.42`, `duration: 5.2`, `repeat: Infinity`, `ease: "easeInOut"` | Static partially-drawn render (`pathLength: 1`, `opacity: 0.55`); no loop |

### App shell + global surfaces

| File | Component | Purpose | Variant / transition | Reduced-motion path |
|------|-----------|---------|----------------------|---------------------|
| `components/UserMenu.tsx` | Dropdown entrance | Top-right user cluster menu | `initial={{ opacity: 0, scale: 0.95, y: -4 }}`, `exit` reverses, `DURATION_MICRO` + `EASE_OUT`, wrapped in `AnimatePresence` | `initial={false}` when reduce; instant show/hide |
| `components/UserMenu.tsx` | Role submenu expand | Inline submenu for demo roles | `initial={{ opacity: 0, height: 0 }}`, `animate={{ opacity: 1, height: "auto" }}`, `AnimatePresence` | `initial={false}` when reduce |
| `components/ui/Toast.tsx` | Toast enter | Top-right stack, spring slide from right | `initial={{ opacity: 0, x: 24 }}`, `animate={{ opacity: 1, x: 0 }}`, `SPRING_DEFAULT` | `duration: 0` transition |
| `components/ui/Toast.tsx` | Toast exit | Quick fade + slide-out | `exit={{ opacity: 0, x: 24, transition: { duration: DURATION_MICRO, ease: EASE_OUT } }}` | Instant exit |
| `components/ui/Toast.tsx` | Stack layout | AnimatePresence + motion.div `layout` | N/A | Instant layout updates |
| `components/ConfirmDialog.tsx` | Modal | Backdrop + dialog entrance/exit | `overlayFade` on backdrop, `dialogPop` on dialog, `DURATION_MICRO` + `EASE_OUT`, `AnimatePresence` mode="wait" | Instant entrance + exit; focus trap unchanged |
| `components/EmptyState.tsx` | State fade-in | Empty-state surfaces | `overlayFade`, `DURATION_SHORT` + `EASE_OUT` | `duration: 0` |

### Record detail

| File | Component | Purpose | Variant / transition | Reduced-motion path |
|------|-----------|---------|----------------------|---------------------|
| `components/record-detail/WorkflowTimeline.tsx` | Layout | Responsive node + line timeline | `layout` on motion.ol and each motion.li | Instant reflow |
| `components/record-detail/WorkflowTimeline.tsx` | Current-node ring | Scale-in ring when current stage changes | `initial={{ scale: 0.6, opacity: 0 }}`, `SPRING_SOFT` | `{ duration: 0 }`, no scale |
| `components/record-detail/WorkflowTimeline.tsx` | Connector fill | Line between old-current and new-current "fills" on advance | `initial={{ scaleX: 0 }}`, `animate={{ scaleX: 1 }}`, `DURATION_LONG` + `EASE_OUT_EXPO`, transform-origin left | Instant fill |
| `components/record-detail/EvaluationPanel.tsx` | Can-progress bar | Tone-matched fill bar with icon swap | Inline motion.span width, `SPRING_SOFT`; `AnimatePresence` mode="wait" icon swap | Instant |
| `components/record-detail/EvaluationPanel.tsx` | Risk score bar | Fill width animates between scores and band colors | `motion.div layout animate={{ width }}`, `SPRING_SOFT` | Instant |
| `components/record-detail/EvaluationPanel.tsx` | Panel layout | Neighbours reflow on issue expand/collapse | `motion.div layout` | Instant |
| `components/SeverityPanel.tsx` | Issue list | Staggered entrance of blocking/warning rows | `staggerParent` + `fadeRise` on each motion.li | Instant |
| `components/SeverityPanel.tsx` | Risk chip pulse | Scale-pulse when risk value changes | Imperative `animate(ref, { scale: [1, 1.08, 1] })`, `DURATION_SHORT` | Skipped via `if (!reduce)` guard |
| `components/SeverityPanel.tsx` | Empty state fade | "No blocking issues" tone | `overlayFade`, `DURATION_SHORT` + `EASE_OUT` | Instant |
| `components/record-detail/AuditTrail.tsx` | List stagger | Audit rows reveal on mount | `MotionList` (staggerParent) + `fadeRise` per row | Instant |
| `components/record-detail/AuditTrail.tsx` | Raw payload toggle | Expand/collapse non-semantic keys | `AnimatePresence`, `initial={{ opacity: 0, height: 0 }}`, `duration: 0.22` | Instant |
| `components/record-detail/AuditTrail.tsx` | Disclosure chevron | Rotation when toggle opens | Inline `animate={{ rotate: rawOpen ? 90 : 0 }}` | No rotation animation |
| `components/record-detail/DocumentRows.tsx` | Overflow menu | ⋯ popover entrance/exit | `initial={{ opacity: 0, scale: 0.95 }}`, `AnimatePresence`, `DURATION_MICRO` + `EASE_OUT`, origin-top-right | `initial={false}` when reduce |
| `components/record-detail/PreviewOverlay.tsx` | Modal | Backdrop + dialog entrance/exit | `overlayFade` + `dialogPop`, `AnimatePresence` mode="wait", `DURATION_MICRO` + `EASE_OUT` | Instant; focus trap and ESC-close unchanged |
| `components/ui/RuleCodeBadge.tsx` | Copy swap | Code ↔ "Copied" label swap on click | `AnimatePresence` mode="wait", `initial={{ opacity: 0, y: ... }}`, `DURATION_SHORT` + `EASE_OUT_EXPO` | `{ duration: 0 }` |

### Dashboard + records

| File | Component | Purpose | Variant / transition | Reduced-motion path |
|------|-----------|---------|----------------------|---------------------|
| `app/(app)/dashboard/page.tsx` | KPI hero cascade | Four KPICards reveal in sequence on mount | Parent motion.div `staggerParent`, each child wrapper `fadeRise`, `SPRING_DEFAULT` | Instant |
| `app/(app)/dashboard/page.tsx` | LiveIndicator swap | LIVE ↔ STALE label swap on poll error | `AnimatePresence` mode="wait", `initial={{ opacity: 0, y: 2 }}`, `duration: 0.18`, `ease: "easeOut"` | Instant |
| `app/(app)/dashboard/page.tsx` | Needs-attention rows | MotionList tbody with staggered entrance + layout reorder on children-change | `staggerParent` (tight) + `fadeRise`, `motion.tr layout` | Instant; layout is an instant reposition |
| `components/ui/MotionList.tsx` | Primitive | Stagger wrapper with `LayoutGroup`; `staggerWhen="children-change"` re-keys on child count shift | Variant-driven, `staggerParent` / `staggerParentTight` | Parent variants collapse to instant |
| `components/StatCard.tsx` | Count-up | Numeric value animates from 0 to final via `useMotionValue` + `useTransform` + `animate()` | `DURATION_LONG`, `EASE_OUT_EXPO` | `motionValue.set(value)` immediately |
| `components/StatCard.tsx` | Sparkline draw | motion.path `pathLength` 0 → 1 on mount | `DURATION_MEDIUM`, `EASE_OUT_EXPO` | `initial={false}` when reduce; path starts fully drawn |
| `components/ui/KPICard.tsx` | Count-up | Same as StatCard via shared AnimatedNumber | See above | Same |
| `components/ui/AnimatedNumber.tsx` | Count-up primitive | Shared `useMotionValue` + `useTransform` + `animate()` | `DURATION_LONG`, `EASE_OUT_EXPO` | Immediate set |

### Operations

| File | Component | Purpose | Variant / transition | Reduced-motion path |
|------|-----------|---------|----------------------|---------------------|
| `app/(app)/operations/page.tsx` | Audit-chain broken border | BoxShadow ring fades in when chain broken | `animate={{ boxShadow }}`, `DURATION_SHORT` + `EASE_OUT` | Instant swap |
| `app/(app)/operations/page.tsx` | Inventory cells stagger | Four storage inventory cells stagger on mount | `MotionList` + `fadeRise`, `SPRING_DEFAULT` | Instant |

### Login

| File | Component | Purpose | Variant / transition | Reduced-motion path |
|------|-----------|---------|----------------------|---------------------|
| `app/login/page.tsx` | Card entrance | Sign-in card enters on first paint | `fadeRise`, `SPRING_DEFAULT` | `{ duration: 0 }` |

### Logomark

| File | Component | Purpose | Variant / transition | Reduced-motion path |
|------|-----------|---------|----------------------|---------------------|
| `components/ui/Logomark.tsx` | Draw-in | Two interlocked chevrons draw on first session mount | motion.path `pathLength` 0 → 1, `DURATION_MEDIUM` + `EASE_OUT_EXPO`, staggered 120ms | `shouldAnimate=false` when reduce; static paths |

## CSS animation

`chain-pulse` — the one CSS keyframe in `tailwind.config.ts`. A soft
ambient heartbeat used for "live" indicators: the blocked status
dot (`components/StatusBadge.tsx`) and the dashboard LIVE pill dot
(`app/(app)/dashboard/page.tsx`). Perpetual, JS-free, respects the
Tailwind global reduced-motion rule in `app/globals.css`.

## When adding new motion

1. Is there a named variant that fits? Use it.
2. Is the transition a standard preset? Use `useMotionTransition`.
3. Does the component respect `useReducedMotion()`? It must.
4. Does the new surface appear in the audit table above? Add a row.
