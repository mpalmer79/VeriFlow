You are working on the VeriFlow repository. Read CLAUDE.md, ARCHITECTURE.md, README.md, and docs/product_thesis.md before touching any file. These establish the project voice, scope boundaries, and existing conventions. Your job is to elevate VeriFlow's frontend and fix a small set of documented defects without touching domain logic, the rule engine, the audit chain, or the evidence pipeline.

This plan is executed in PHASES. Do not start a phase until the previous phase is complete, tested, and committed. Do not merge phases. Do not "optimize" by reaching ahead. After each phase, STOP and summarize what changed, then wait for me to say "continue" before starting the next phase. If you finish a phase and the acceptance criteria are not all green, fix them before stopping — do not report "done" with known failures.

Hard constraints that apply to EVERY phase:

- Do not modify any file under backend/app/services/, backend/app/models/, backend/app/core/evidence_storage.py, backend/app/core/security.py, or backend/app/core/content_access.py unless a phase explicitly says to. The backend domain layer is out of scope.
- Runtime dependencies: Framer Motion (framer-motion) is an approved primary dependency for this plan — use it for any non-trivial motion work. Tailwind keyframes stay appropriate for simple one-shot CSS transitions (hovers, simple fades), but every orchestrated animation, layout animation, gesture-driven motion, stateful reveal, stagger, or shared-layout transition must use Framer Motion. Do not hand-roll requestAnimationFrame loops, manual transition-delay chains, or custom stagger code when a Framer Motion primitive (`motion`, `AnimatePresence`, `LayoutGroup`, `useAnimate`, `useInView`, `useMotionValue`, `useTransform`, `useScroll`, `useSpring`, `useReducedMotion`) exists for it. No other motion libraries (GSAP, React Spring, Motion One, Auto-Animate, etc.) — one motion library, used well.
- Do not add icon libraries beyond lucide-react. If lucide-react is not already installed, add it in Phase 1 and no other icon library thereafter.
- Respect the existing design tokens in tailwind.config.ts. Extend them; do not replace them. The severity color semantics (low/moderate/high/critical) are domain-meaningful and must stay stable.
- Every Framer Motion component must consult useReducedMotion() (or equivalent) and degrade to a static render / instant state change when prefers-reduced-motion is set. This is non-negotiable — the tailwind global reduce-motion rule does NOT cover Framer Motion, because Framer Motion drives transforms via JS, not CSS.
- Preserve all existing accessibility properties (ARIA labels, focus traps, focus return after modal close, role="dialog"/"alertdialog", aria-modal, aria-live regions). If you touch a component that has these, verify they still work. Framer Motion's AnimatePresence must not break focus-return behavior — when wrapping modals, keep the existing focus management and use `mode="wait"` only when it's semantically correct.
- Preserve all existing Playwright E2E tests. If a test breaks because of an intentional UI change, update the test in the SAME commit with a brief note explaining why. Do not weaken assertions to make tests pass (e.g. do not replace getByRole with CSS selectors). For Playwright assertions on motion-driven state, assert on final DOM state after animations complete — use `await expect(locator).toBeVisible()` which waits, not timing-based assertions.
- Run `npm run build` and `npm run typecheck` in frontend/ at the end of every phase. Both must pass. Run `npm run test:e2e` at the end of any phase that touched a page component.
- Keep comments sparse and human-written. No "// This function does X" decoration. Comments belong on surprising choices, not obvious ones. Framer Motion variants and transition configs should be named clearly so they don't need comments.
- Keep commits small. One commit per sub-task within a phase is fine. Never a single mega-commit for a whole phase.

Motion language for this plan (apply consistently across phases — this is the app's motion vocabulary):

- Durations: micro 120ms, short 220ms, medium 380ms, long 620ms. Nothing longer than 800ms except the hash-chain ambient heartbeat.
- Easing: use Framer Motion's spring presets for entrances and layout animations (stiffness 300, damping 30 is the house spring); use `[0.22, 1, 0.36, 1]` cubic-bezier for reveals and fades; use `"easeOut"` for exits. Centralize these in frontend/lib/motion.ts as named exports (SPRING_DEFAULT, EASE_OUT_EXPO, EASE_OUT, DURATION_MICRO/SHORT/MEDIUM/LONG) and import from there. No inline magic numbers.
- Stagger: children stagger at 40ms unless the list is >10 items, in which case 25ms. Define staggerChildren in variants, not via setTimeout chains.
- Layout: Framer Motion's `layout` prop and `LayoutGroup` are the right tool for any size/position change driven by state (filter changes reordering rows, stage nodes repositioning, modal size changes). Use them instead of manual transition classes for these cases.
- Reduced motion: the `useReducedMotion()` hook gates every orchestrated animation in the app. A standard pattern is: const reduce = useReducedMotion(); const transition = reduce ? { duration: 0 } : SPRING_DEFAULT; — bake this into frontend/lib/motion.ts as a `useMotionTransition(preset)` hook so it's uniform.

=============================================================================
PHASE 0 — Discovery & Baseline (no code changes)
=============================================================================

Before writing any code, produce a short written audit and commit it as docs/ui_elevation_baseline.md. This is the plan of record; later phases will reference it.

The audit must contain:

0.1. A table of every route under frontend/app/ with: path, purpose, current top-level heading, whether it fetches data, whether it is gated, known issues (reference my earlier review).

0.2. A list of every shared component under frontend/components/ with a one-line purpose and a note on whether it is touched in this plan.

0.3. A list of every CSS custom animation currently defined in tailwind.config.ts or globals.css, and a note for each on whether it will be replaced by a Framer Motion equivalent (most should be) or retained as a simple CSS primitive.

0.4. A table of known UI defects being fixed in this plan, each with: defect, affected files, phase that fixes it, acceptance test.

0.5. A short "Motion inventory" section listing every place in the app where motion currently exists (page-in fades, overlay-in, dialog-in, skeleton pulses, the 1600ms login fade) and the target state per location (Framer Motion orchestration / CSS primitive / removed).

0.6. Screenshots are NOT required. Descriptive prose is.

Commit: "docs: UI elevation baseline audit".

Stop. Wait for "continue".

=============================================================================
PHASE 1 — Design System Foundation
=============================================================================

Goal: establish the visual identity and motion primitives that every later phase will build on. No user-visible page changes yet; this phase is pure foundation.

1.1. Add framer-motion and lucide-react to frontend/package.json if not already present. Pin specific versions. Framer Motion 11.x or later (uses the modern `motion/react` import surface — use `import { motion } from "motion/react"` if on v11.11+, otherwise `import { motion } from "framer-motion"`; pick one and be consistent across the codebase).

1.2. Extend tailwind.config.ts:

  - Add a "brand" color ramp (50..900) that is VeriFlow's signature color. It must NOT be the default blue. Pick one color that reads as "compliance + intelligence" — my recommendation is a desaturated teal (#0e7490-adjacent) or a deep indigo. Decide, justify in the commit message, and commit. No purple gradients.
  - Add a "verified" color distinct from "severity.low" for document-verification success states.
  - Add a "rejected" color distinct from "severity.critical" for document-rejection states (rejected is a user action, not a system emergency).
  - Add fontFamily.display using a distinctive display font via next/font — NOT Inter (Inter stays as sans). My recommendation: "Instrument Serif" or "Fraunces" for editorial weight, or "JetBrains Mono" at display weight if you want to lean industrial. Pick one, justify it.
  - REMOVE the `page-in` (1600ms), `fade-in`, `fade-in-slow`, `overlay-in`, `dialog-in` keyframes. They are being replaced by Framer Motion primitives in later phases. Keep only the `pulse` utility Tailwind ships by default and add one new keyframe: `chain-pulse` (a soft hash-chain heartbeat, 3s infinite). `chain-pulse` is the ONE CSS animation in the app — used for ambient "live" indicators (blocked status dot, live-indicator dot on dashboard). Everything else goes through Framer Motion.

1.3. Update frontend/app/layout.tsx to load the new display font via next/font alongside Inter and JetBrains Mono. Expose it as a CSS variable.

1.4. Update frontend/app/globals.css:
  - Add a noise-texture utility class (a very subtle SVG noise background) — the kind of detail that makes dark UIs feel deliberate instead of flat. Opacity 0.015-0.025 MAX. Gate behind a .textured parent class so it is opt-in.
  - Add a "brand gradient" utility: a tight radial gradient in the brand color family, used sparingly on hero surfaces.
  - Remove the `animate-*` references that pointed to the deleted keyframes.
  - Do NOT globally apply noise or gradient. They are opt-in utilities.

1.5. Create frontend/lib/motion.ts — the central motion vocabulary module. Exports:

  - DURATION_MICRO = 0.12, DURATION_SHORT = 0.22, DURATION_MEDIUM = 0.38, DURATION_LONG = 0.62 (seconds, Framer Motion convention).
  - EASE_OUT_EXPO = [0.22, 1, 0.36, 1] as const.
  - EASE_OUT = "easeOut" as const.
  - SPRING_DEFAULT = { type: "spring", stiffness: 300, damping: 30 } as const.
  - SPRING_SOFT = { type: "spring", stiffness: 180, damping: 26 } as const. (for large-surface motion like the timeline advance)
  - STAGGER_TIGHT = 0.025, STAGGER_DEFAULT = 0.04.
  - Named variants that recur across the app:
    - fadeRise: { hidden: { opacity: 0, y: 6 }, visible: { opacity: 1, y: 0 } }
    - fadeRiseSlow: { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }
    - overlayFade: { hidden: { opacity: 0 }, visible: { opacity: 1 } }
    - dialogPop: { hidden: { opacity: 0, y: 8, scale: 0.98 }, visible: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, y: 8, scale: 0.98 } }
    - staggerParent: { hidden: {}, visible: { transition: { staggerChildren: STAGGER_DEFAULT } } }
    - staggerParentTight: (same, with STAGGER_TIGHT)
  - Hook: `useMotionTransition(preset: "spring" | "easeOut" | "expoOut", overrides?)` — wraps useReducedMotion() and returns `{ duration: 0 }` when reduce is true, otherwise the corresponding transition. This is the single choke point for motion/reduced-motion logic — every Framer Motion call site either uses this hook or a named variant from this file.

  Add a brief comment at the top of the file: "Motion vocabulary for VeriFlow. Import from here; do not hand-roll transitions at call sites."

1.6. Create frontend/components/icons/index.ts that re-exports the specific lucide icons we will use. Do not wildcard-export. This keeps the bundle tight. Start with: ShieldCheck, AlertTriangle, AlertOctagon, Link2 (hash chain), Fingerprint, FileCheck2, FileX2, Clock, Activity, ArrowRight, ChevronRight, Circle, CircleCheck, CircleDot, Loader2, MoreHorizontal, Copy, Check, ExternalLink.

1.7. Create frontend/components/ui/Logomark.tsx. A small, composable React SVG logomark for VeriFlow. Must be visually distinctive — NOT a generic checkmark in a circle. Think of the two V's interlocking, or a chain link with a verification mark. Takes `className` and `size` props. Monochrome (uses currentColor) so it inherits text color. Acceptance: the logomark renders recognizably at 16px and at 96px. If the logomark is animated (optional: a subtle draw-in on first mount via Framer Motion `<motion.path>` with pathLength), the animation runs once per session (use sessionStorage) and respects reduced motion.

1.8. Update the header logo in frontend/components/AppShell.tsx to use <Logomark /> instead of the 2px dot. Keep the "VeriFlow" wordmark next to it. Wordmark uses the new display font at an appropriate weight.

Acceptance for Phase 1:
- npm run build passes.
- npm run typecheck passes.
- framer-motion is a declared dependency in package.json with a pinned version.
- The motion vocabulary file exists and is imported at least once (by the Logomark if animated, or exercised via a dev-only test import).
- Visual smoke: loading /dashboard shows the new logomark and wordmark in the header; the rest of the page is unchanged. (The old CSS-keyframe page-in/fade-in animations are gone — pages may look slightly more abrupt until Phase 3 replaces them with Framer Motion entrances. That is expected.)
- No new runtime warnings in the browser console.

Commit messages should be scoped: "feat(deps): add framer-motion and lucide-react", "feat(theme): add brand color ramp", "feat(theme): add display font", "feat(theme): remove legacy keyframes", "feat(motion): add motion vocabulary module", "feat(ui): logomark component", "refactor(appshell): use logomark". One commit per.

Stop. Wait for "continue".

=============================================================================
PHASE 2 — StatCard, SeverityPanel, and core primitives
=============================================================================

Goal: elevate the smallest shared components so every page that uses them upgrades for free. No new pages yet. This phase is where Framer Motion starts showing up in user-visible ways.

2.1. Rewrite frontend/components/StatCard.tsx:
  - Accept an optional `icon` prop (a lucide icon component) rendered top-right of the card at 20px, in the tone's color at 60% opacity.
  - Accept an optional `trend` prop: { direction: "up" | "down" | "flat", delta: string, sublabel?: string }. When present, render a compact trend row under the value with a matching arrow icon.
  - Accept an optional `spark` prop: an array of numbers. When present, render a tiny inline sparkline (SVG, no library — a single <path> stroke) under the value, 8px tall, in the tone color. The sparkline path draws in on mount using Framer Motion `<motion.path>` with pathLength animating 0 → 1 over DURATION_MEDIUM with EASE_OUT_EXPO.
  - Mount count-up animation: use Framer Motion's `useMotionValue` + `useTransform` + `animate` to drive the displayed number from 0 to its final numeric value over DURATION_LONG. String values (like "—") render instantly. Must respect useReducedMotion() — when reduce is true, the final value renders immediately.
  - Keep the `tone` prop and tone-to-color mapping. Add an "ok" tone that uses the new "verified" color.

2.2. Rewrite frontend/components/SeverityPanel.tsx (the blocking/warnings panel on record detail):
  - Render a leading icon column per issue: AlertOctagon for critical, AlertTriangle for warning. Icon color matches the panel tone.
  - The rule_code stays in mono font but wrap it in a RuleCodeBadge component you will create at frontend/components/ui/RuleCodeBadge.tsx. The badge has a subtle bg-surface-muted background, rounded-md, mono text, and a copy-on-click behavior: click → navigator.clipboard.writeText → an inline Framer Motion AnimatePresence swap: the code text slides up and out, a small green "Copied" label with a Check icon slides up and in, holds for 1.5s, then reverses. Use the dialogPop-style variants adapted for inline swap. Acceptance: clicking the badge copies the rule code and visibly confirms.
  - The issue list uses Framer Motion staggered entrance: parent has `variants={staggerParent} initial="hidden" animate="visible"`, each `<li>` uses `variants={fadeRise}`. This makes the "found 3 blocking issues" moment feel like a real reveal.
  - The `+N` risk chip becomes a visually heavier element — a small pill with the tone color at 25% opacity background, tone color text, and the number in the display font at weight 600. When the risk value changes (re-evaluation), the chip does a subtle scale pulse (scale: [1, 1.08, 1] via Framer Motion, DURATION_SHORT).
  - Empty states get their own icon (CircleCheck in the verified color) and are centered vertically. The empty state fades in with the overlayFade variant.

2.3. Rewrite frontend/components/StatusBadge.tsx and frontend/components/DocumentStatusChip.tsx:
  - Add a small leading dot (4px) in the status color before the label text. This is the micro-affordance that makes status at-a-glance parseable.
  - For StatusBadge "blocked": the dot gets the `chain-pulse` CSS animation (not Framer Motion — this is an ambient heartbeat, CSS is correct here). This is the ONE place we allow a perpetual ambient animation on a list surface — because blocked is the thing operators scan for.

2.4. Create frontend/components/ui/KPICard.tsx — a larger variant of StatCard for the dashboard hero row. Same API but wider, taller, with a stronger typographic hierarchy (display font for the value, uppercase kern-spaced label). Same count-up animation via Framer Motion as StatCard. This is what will replace the four blank cards at the top of the dashboard.

2.5. Create frontend/components/ui/MotionList.tsx — a reusable wrapper that applies the staggered entrance pattern to any list of children. Props: `as` (ul/ol/div default), `staggerWhen` ("mount" | "children-change" — the latter re-triggers stagger when the children array length changes, used for filter re-sorts). Internally uses LayoutGroup for smooth reordering. Use this in Phase 5's "Needs attention" table and anywhere else a list benefits from ordered reveal.

Acceptance for Phase 2:
- All pages that use StatCard/SeverityPanel/StatusBadge/DocumentStatusChip still render without runtime errors.
- Existing Playwright tests still pass.
- The copy-to-clipboard on RuleCodeBadge works in the dev server AND the "Copied" swap is visible.
- Count-up animation on StatCard works; toggling prefers-reduced-motion in OS settings disables both the count-up and the sparkline draw.
- Blocked status dot pulses; no other status dot pulses.

Commit per sub-task.

Stop. Wait for "continue".

=============================================================================
PHASE 3 — The Landing Page (/)
=============================================================================

Goal: replace the "redirect-only" root route with a real product landing surface. This is THE most visible change in this plan and the first place Framer Motion gets to do its full job.

3.1. Refactor frontend/app/page.tsx. The current logic (auto-sign-in as admin when demo mode is on, redirect to /login otherwise) moves into a NEW route /enter that preserves the existing behavior. The root page.tsx becomes a real landing page.

3.2. The landing page is a single scroll surface, not a multi-route marketing site. It must contain, in order:

  Section A — Hero:
  - Logomark + wordmark centered, sized for impact
  - Headline in the display font: "Process compliance you can prove." (or generate 2-3 alternatives and pick the strongest). Max 60 chars.
  - Subhead in sans: 1-2 sentences explaining VeriFlow without jargon.
  - Two CTAs: primary "Enter demo" → /enter, secondary "See how it works" → smooth-scrolls to Section B.
  - Ambient visual: a subtle animated hash-chain motif behind or beside the hero. Built as SVG, animated with Framer Motion — a series of interlocking chain links where each link's stroke pathLength cycles 0 → 1 → 0 in sequence, staggered, infinite. The animation runs at low opacity (0.15-0.25) and slows dramatically when prefers-reduced-motion is set (use useMotionValue for the ambient timer so you can pause it). The motif is small, quiet, and disappears behind the content on mobile.

  Section B — "What it actually does":
  - Three pillars, each with an icon, a short title, one sentence of body copy:
    1. Controlled transitions (ShieldCheck)
    2. Tamper-evident audit (Link2)
    3. Verifiable evidence (Fingerprint)
  - Prose comes from README.md's "What it actually does" section — rewrite tightly, do not copy-paste.

  Section C — "Explainability, not black-box":
  - A single mockup panel that looks like a real VeriFlow evaluation result: a stage name, a blocking issue with rule code and risk weight, a warning, a risk-band pill. This is the HERO differentiator — show it, don't describe it.
  - The mock uses real component code (SeverityPanel from Phase 2) with static props, so it evolves with the app.
  - On scroll-into-view, the mock's issues stagger-reveal using the same variants SeverityPanel already uses. This is where the staggered reveal earns its keep: the viewer sees "1 blocking issue, 2 warnings" appear in sequence, which communicates the evaluation concept visually.

  Section D — "Healthcare intake is a scenario, not the product":
  - A compact diagram of the 9 stages of the healthcare intake workflow as example — using the WorkflowTimeline component (which Phase 4 will rebuild). If Phase 4 isn't done yet, use a simpler row of labeled pills as placeholder and leave a TODO comment referencing the phase.
  - Prose: one short paragraph making the domain-agnostic point.

  Section E — Footer:
  - Small, 3-column: left = Logomark + copyright, center = links (GitHub repo, docs, ARCHITECTURE.md), right = "Built with FastAPI + Next.js" tagline with appropriate link handling.

3.3. Motion budget for the landing page — THIS is where Framer Motion is central:

  - Section A: hero elements enter on mount with a sequential cascade. Logomark first (fadeRise), then headline (fadeRise with delay), then subhead, then CTAs — each using the staggerParent pattern with STAGGER_DEFAULT, wrapped in a single parent motion.div. The chain-motif animation starts after the cascade completes (use `transition={{ delay: 0.8 }}` on its opacity).
  - Sections B through E reveal on scroll-into-view using Framer Motion's `useInView` hook + `whileInView` prop, with `viewport={{ once: true, margin: "-10%" }}`. Each section is a motion.section with variants={fadeRiseSlow}.
  - Pillars in Section B stagger their entrance: the section uses staggerParent, each pillar uses fadeRise.
  - The brand CTA button has a subtle whileHover={{ y: -1 }} whileTap={{ y: 1 }} micro-interaction.
  - No parallax. No horizontal scroll tricks. One cohesive vertical reveal, done well.
  - Every motion element must degrade under prefers-reduced-motion via useReducedMotion() or the useMotionTransition hook from Phase 1.

3.4. Typography on the landing page:
  - Display font for H1 (hero), H2 (section headings).
  - Sans for body copy, chips, buttons.
  - Mono ONLY for the rule code in Section C (as it would appear in-app).

3.5. Color on the landing page:
  - Primary surface: the existing dark surface (#0b1220).
  - Brand color from Phase 1 used for: CTA primary, the chain motif, section H2 accents.
  - No purple gradients. No rainbow. If you add a gradient, it is brand-color-to-transparent, used once, in the hero.

3.6. Accessibility:
  - Every section has a proper landmark role.
  - The smooth-scroll CTA uses href="#section-b" as a fallback and preventDefault + scrollIntoView({ behavior: "smooth" }) for the enhanced path. prefers-reduced-motion disables the smooth behavior.
  - Hero CTAs are real <Link> to /enter and proper <a href="#section-b"> — not buttons with router.push.
  - The chain motif has aria-hidden="true".

3.7. Create a Playwright spec frontend/tests/e2e/landing.spec.ts:
  - /  renders the logomark, headline, and two CTAs.
  - Clicking "Enter demo" navigates to /enter (demo mode on: auto-signs in; off: redirects to /login).
  - Smooth-scroll anchor works.
  - Landing page is NOT shown to users with an existing valid token — they redirect to /dashboard (move this logic; do not duplicate it).
  - Do not test animation timing. Test final DOM state.

Acceptance for Phase 3:
- /  renders the landing page for anonymous visitors.
- /enter preserves the old root behavior exactly (including the demo-mode failure banner).
- Authenticated users visiting / are redirected to /dashboard.
- All existing tests + the new landing.spec.ts pass.
- First contentful paint is snappy; the landing page is static-ish and should not fetch data.
- Visiting the page with prefers-reduced-motion set in devtools: all sections are immediately visible, no reveal animations run, the chain motif is static.

Stop. Wait for "continue".

=============================================================================
PHASE 4 — The WorkflowTimeline rebuild
=============================================================================

Goal: replace the flex-wrap-of-badges-with-chevrons implementation with a real animated progress component that dramatizes stage advancement. Framer Motion's layout animations make this phase shine.

4.1. Rewrite frontend/components/record-detail/WorkflowTimeline.tsx. The new component:
  - Renders stages horizontally on wide viewports, vertically on narrow viewports (< sm).
  - Each stage is a node: a small circle (8px) with a connecting line to the next node. Past nodes are filled in the verified color; the current node is filled in the brand color and has a 2px ring. Future nodes are an empty outline in text-muted.
  - Stage name sits below (or to the right of, on mobile) each node, truncating elegantly on small screens.
  - Terminal stages (is_terminal) get a special treatment: the "Blocked" terminal is the critical color, the "Closed" terminal is the text-subtle color. Both use a different node glyph (square instead of circle) to communicate terminality.
  - The connecting line between a past node and its successor is a solid 1px line in the verified color. Between current→future is a dashed 1px line in text-subtle.

4.2. Transition animation — use Framer Motion, not CSS:
  - Wrap the entire timeline in a motion.ol with layout.
  - Each node is a motion.li with layout so it animates position changes smoothly on viewport resize.
  - When `currentStageId` changes (React prop), the newly-current node animates:
    - The ring scales in from scale 0.6 to 1.0 using SPRING_SOFT.
    - The node's background color transitions to the brand color over DURATION_SHORT.
  - The connecting line between the old-current and new-current "fills" using Framer Motion: the line is a motion.div with an absolutely-positioned motion.span overlay whose scaleX animates 0 → 1 over DURATION_LONG with EASE_OUT_EXPO, originating from the left edge. Use transformOrigin to anchor correctly.
  - This is the product's "moment of progress" — it should feel deliberate and satisfying, not cute.
  - Respect useReducedMotion: animation becomes an instant state change (transitions become `{ duration: 0 }`).

4.3. Do NOT expose the animation via a prop. It just happens when the prop changes. Detect transitions via comparing `currentStageId` with a useRef of the previous value.

4.4. Integrate:
  - On the record detail page, after a successful transition (handleTransition in app/(app)/records/[id]/page.tsx), the record reloads via refreshAll — the new stage id flows down to the timeline which triggers the animation automatically. No extra wiring needed.

4.5. Add Playwright test to frontend/tests/e2e/records.spec.ts (or extend existing): after a transition, the new current stage is visible and the expected node has the ring indicator. Don't assert on animation timing — assert on final DOM state using `toHaveClass` or data attributes.

Acceptance for Phase 4:
- Record detail page shows the new timeline.
- Nine stages fit on a desktop viewport without the old `›` wrap issue.
- Mobile viewport renders vertical stepper.
- Transition → visible advancement with the line-fill animation (can verify by just clicking through the demo).
- Resizing the browser smoothly re-lays out the timeline (Framer Motion layout animation in action).
- Existing tests still pass.

Stop. Wait for "continue".

=============================================================================
PHASE 5 — Dashboard elevation
=============================================================================

Goal: take the dashboard from "serviceable admin table" to "operations intelligence". No backend changes.

5.1. Hero row — replace the four StatCards with four KPICards (from Phase 2). Wire up:
  - Total records: value = stats.total, icon = Activity, no tone color for value.
  - In progress: value = stats.inProgress, icon = Clock, tone = neutral.
  - Blocked: value = stats.blocked, icon = AlertOctagon, tone = critical. The KPICard for blocked should have a subtle brand-critical border when blocked > 0, and an AnimatePresence-wrapped tone change when it crosses the 0 threshold (no blocked → some blocked transitions the border in).
  - High/critical risk: value = stats.highRisk, icon = AlertTriangle, tone = warning.
  - Count-up animation on all four on mount (inherited from KPICard).
  - The four cards stagger-enter using staggerParent / fadeRise variants.

5.2. Multi-workflow stage name fix (BUG FIX — this is the defect called out in the baseline audit):
  - Replace the `const firstWorkflowId = result[0]?.workflow_id` pattern with one that fetches stages for EVERY unique workflow id present in the result, in parallel (Promise.all over unique ids). Build a Map keyed on `${workflow_id}:${stage_id}` → stage.
  - Apply the same fix to frontend/app/(app)/records/page.tsx.
  - Add a Playwright test or unit test that covers this: records spanning two workflows render their correct stage names.

5.3. Live indicator:
  - Add auto-refresh: poll every 30 seconds. Use a visible "LIVE" pill in the page header with a tiny pulsing dot (the chain-pulse CSS keyframe from Phase 1 — ambient, perpetual, CSS is correct). The existing manual Refresh button stays for users who want it.
  - Poll pauses when the page is not visible (document.visibilityState !== "visible") — use visibilitychange. Reduces load on hosted Postgres.
  - On refresh error, the pill transitions (Framer Motion AnimatePresence + mode="wait") from "LIVE" to "STALE" in the warning color. Poll continues; stale is recoverable.

5.4. URL-synced filters (applies to records page; fix in the same phase because it touches similar code):
  - In frontend/app/(app)/records/page.tsx, migrate `search`, `stageId`, `riskBand`, `status` from useState to useSearchParams + router.replace. Filters in the URL survive refresh, back button, and share links.
  - Preserve existing UX; this is purely a state-storage migration.

5.5. "Needs attention" table polish:
  - Wrap the <tbody> rows in MotionList (from Phase 2) with `staggerWhen="children-change"` so filter changes re-stagger gracefully. This uses Framer Motion's LayoutGroup under the hood — rows that persist across filter changes smoothly reposition instead of flashing.
  - Row hover shows a subtle brand-colored left border (2px inset, -ml so layout doesn't shift). On blocked rows the left border is already there and turns brand-critical on hover.
  - The subject name link gets a proper hover state (no bare underline).

5.6. Flash message upgrade (applies app-wide — touch ActionBar and any inline flash renderer):
  - Replace inline text flashes with a Toast component that lives top-right, stacks, auto-dismisses non-error toasts after 6s, stays on error.
  - Create frontend/components/ui/Toast.tsx and ToastProvider.
  - Toasts enter with Framer Motion (slide-in from right + fade, DURATION_SHORT, SPRING_DEFAULT), exit with a quick fade + slide-out (DURATION_MICRO, EASE_OUT). Stacking is handled with AnimatePresence.
  - This is shared infrastructure: provider at the app layout level, useToast() hook for consumers.
  - Existing ActionBar flash state migrates to toast emission. Delete the ActionBar flash rendering block. Keep the ActionBar's flash prop for ONE commit, then remove it and update call sites in the next commit.

Acceptance for Phase 5:
- Dashboard hero row is visibly upgraded with icons, staggered entrance, and count-up animation.
- Opening the dashboard then backgrounding the tab pauses polling (verify with a console.log during dev — remove log before commit).
- Records page filters are in the URL.
- Multi-workflow records render correct stage names.
- Toasts replace inline flashes on both dashboard and record detail.
- Filter changes on the records page smoothly reflow rows (layout animation visible).

Stop. Wait for "continue".

=============================================================================
PHASE 6 — Record detail surfaces
=============================================================================

Goal: make the record detail page feel like the app's center of gravity, not a form.

6.1. ActionBar restructure:
  - Visual hierarchy: "Run evaluation" stays prominent but moves to the LEFT. "Attempt transition" becomes the primary visual action (brand color, larger) paired tightly with its stage selector — this is the decisive action on the page. "Refresh" becomes an unobtrusive icon-only button in the action bar's far right with aria-label="Refresh".
  - Transition selector UX: when the selected target stage would fail evaluation (current decision has blocking issues), disable "Attempt transition" and show a tooltip "Resolve blocking issues first" — but still allow evaluation to run.

6.2. EvaluationPanel hero treatment — the most-designed surface in the app:
  - The "Can progress" indicator becomes a large visual — a horizontal bar that fills in the verified color when Yes, the critical color when No, with an icon (CircleCheck or AlertOctagon) inline. Driven by Framer Motion: the bar's width transitions using layout animation when the decision changes (Yes → No or vice versa), the icon AnimatePresence-swaps.
  - The risk score gets a dedicated visual: a horizontal progress bar (0-100) with band thresholds marked (25, 50, 80) as subtle tick marks. The fill is a motion.div whose width animates from the previous risk score to the new one using SPRING_SOFT — this makes risk changes visible. The fill color matches the risk band, transitioning smoothly when the band changes.
  - Summary copy stays but moves below the visuals.
  - The panel as a whole uses Framer Motion's layout prop so when issues collapse/expand, neighbors reflow smoothly.

6.3. AuditTrail upgrade:
  - Replace the font-mono key/value grid with a structured, human-readable layout: each event gets an icon (ArrowRight for transition, Activity for evaluation, FileCheck2 for document.verified, FileX2 for document.rejected, Link2 for storage.cleanup, etc.).
  - Rule codes inside the payload render as RuleCodeBadge (from Phase 2).
  - Stage references render as the stage name (resolve via the existing stagesById map), with the stage id as a subtle mono affordance next to it.
  - Timestamps use formatDateTime but also show relative time ("2 minutes ago") next to absolute. Helper: create frontend/lib/relative-time.ts.
  - The payload keys that have no semantic meaning to non-developers (like `entry_hash` details) are hidden by default behind a "Show raw payload" toggle. The toggle uses AnimatePresence + layout to expand/collapse smoothly — no height: auto hacks.
  - The audit list uses MotionList for staggered mount entrance.

6.4. DocumentRows action overflow:
  - Primary row actions (always visible): Preview (if previewable and stored), Download (if stored), Verify (if stored, not verified), Reject (if not rejected).
  - Secondary actions collapsed into a "⋯" overflow menu (MoreHorizontal icon): Integrity check, Delete.
  - Use a simple popover built with Framer Motion: the menu is a motion.div that enters with scale: 0.95 → 1 and opacity: 0 → 1 from the anchor, DURATION_MICRO. AnimatePresence handles exit. Click-outside close, Escape-to-close.
  - Keyboard accessible: ⋯ button focuses, Enter opens menu, arrow keys navigate items, Escape closes + returns focus to ⋯ button, Tab closes + moves focus forward.

6.5. Preview loading overlay:
  - The full-screen black "Loading preview…" overlay in records/[id]/page.tsx is removed. Instead, the button that triggered the preview shows an inline spinner (Loader2 from lucide, spinning via CSS — this is a rare case where CSS animation is correct because the spinner is perpetual and generic). The overlay only appears once the preview actually has content.
  - Preview overlay itself migrates to AnimatePresence: enter with overlayFade on the backdrop + dialogPop on the dialog, exit in reverse. Replaces the old CSS-keyframe overlay-in and dialog-in animations deleted in Phase 1.

6.6. RecordHeader polish:
  - Larger subject name (display font, text-3xl on desktop).
  - The back link ← All records becomes a proper breadcrumb component: Records / [Subject Name]. Create frontend/components/ui/Breadcrumbs.tsx.
  - The "Record version" meta cell gets a tooltip explaining optimistic concurrency: "Incremented on every state change. Used to prevent conflicting edits."

6.7. Also update the ConfirmDialog in frontend/components/ConfirmDialog.tsx — it still uses the deleted CSS keyframes. Migrate its entrance/exit to AnimatePresence + overlayFade/dialogPop variants. This is a drop-in replacement; the focus-trap and Escape handling stay as-is.

Acceptance for Phase 6:
- All record detail actions still function end-to-end in demo mode.
- Keyboard-only walkthrough of the page is smooth: tab order is sensible, overflow menu is keyboard-accessible, modal focus traps still hold.
- The record detail Playwright test still passes.
- Risk score bar visibly animates when a re-evaluation changes the score.
- ConfirmDialog opens and closes smoothly with no CSS keyframe errors in the console.

Stop. Wait for "continue".

=============================================================================
PHASE 7 — Roles, Operations, and small surfaces
=============================================================================

Goal: clean up the remaining surfaces so the whole app feels cohesive.

7.1. Move "Roles" out of primary nav in AppShell.tsx:
  - The NAV_ITEMS array removes the "Roles" entry.
  - Instead, when in demo mode, the user cluster in the top-right (name + role + sign-out button) becomes a dropdown. Clicking it opens a menu with: "Switch role ▸" (submenu of the four demo roles), "Sign out" / "Reset demo".
  - The dropdown uses Framer Motion AnimatePresence + the same scale+fade pattern as the DocumentRows overflow menu from Phase 6.
  - Selecting a role from the submenu is equivalent to the current /roles switch flow — reuse demoSignInAs.
  - Delete the /roles route. Delete its Playwright coverage if any (update, don't delete, if it covers behavior other than the page itself).

7.2. Sign-out behavior clarification:
  - In demo mode, rename "Reset demo" to "Sign out" (it's lying; it doesn't reset demo state). If a true reset is desirable, that is a SEPARATE future task — not in scope here.

7.3. Login page restraint:
  - The old 1600ms page-in fade was deleted in Phase 1. Replace it with a Framer Motion entrance on the login card: fadeRise variant, DURATION_SHORT, SPRING_DEFAULT. No long fades.
  - The demo operator-note hint stays but gets a real lucide icon (AlertTriangle) and a tighter layout.

7.4. Operations page — already the best surface, make small improvements:
  - The "Audit chain" status chip gets the Link2 icon next to its state.
  - "Chain intact" vs "Chain broken" — when broken, the panel border becomes brand-critical with a subtle Framer Motion entrance for the border color (useTransform / animate); when intact, no special treatment (verified is the default-good state, not a decorated one).
  - Orphan cleanup: add a "Last cleanup" absolute timestamp + relative next to the run-date cell in the report grid. Uses the relative-time helper from Phase 6.
  - The inventory cells stagger-enter with MotionList on page load.

7.5. EmptyState component polish:
  - Accepts an optional `icon` prop. When present, renders the icon at 32px above the title, in text-subtle.
  - Default icon lookup by title keyword is NOT done automatically. The caller passes the icon.
  - The empty state itself fades in with overlayFade when mounted.

7.6. Copy pass — small but visible:
  - Dashboard sublabels: pick one grammatical form (verb phrases) and apply consistently. "moving through stages", "awaiting resolution", "under review".
  - Standardize ellipsis: use the literal character … everywhere. Search the codebase for \u2026 and replace with the literal.

Acceptance for Phase 7:
- Navigation shows Dashboard / Records / Operations only (plus admin-gated items). Roles is gone from nav.
- Demo-mode user dropdown works keyboard-only with smooth entrance/exit.
- /roles route is gone; a direct visit to /roles 404s or redirects to /dashboard.
- Login page entrance is the short spring, not the old 1600ms crawl.

Stop. Wait for "continue".

=============================================================================
PHASE 8 — Final pass: tests, docs, motion audit
=============================================================================

Goal: make sure the elevation doesn't regress anything and is properly documented.

8.1. Expand Playwright coverage:
  - landing.spec.ts (added in Phase 3) must cover: anonymous visit shows landing, authenticated visit redirects to dashboard, smooth-scroll works, keyboard activation of CTAs works.
  - dashboard.spec.ts: KPI hero row renders the four cards with icons; backgrounding the tab via page.evaluate pauses polling; filters survive refresh.
  - record-detail.spec.ts (extend): timeline advances on transition; audit trail shows human-readable stage names; overflow menu is keyboard-accessible.
  - toasts.spec.ts: a toast appears, auto-dismisses for non-error, persists for error.
  - reduced-motion.spec.ts: a NEW spec that sets `reducedMotion: "reduce"` in Playwright's context options and walks the major surfaces (/, /dashboard, /records/:id). Asserts that animated elements reach their final state immediately (no transform mid-animation when a screenshot is captured). This is the regression guard against Framer Motion animations that don't respect useReducedMotion.

8.2. Motion audit document:
  - Create docs/ui_motion_audit.md listing every Framer Motion usage in the codebase: file, component, purpose, variant/transition used, reduced-motion behavior verified. This is a deliverable AND an ongoing hygiene tool — future devs will grep it.
  - Include a "Principles" section at the top reiterating the motion vocabulary (durations, easings, when to use spring vs expo vs linear).

8.3. Update docs:
  - docs/ui_elevation_baseline.md gets a "Completion" section describing what changed in each phase.
  - README.md's "Frontend" bullet gets updated to reflect the new visual identity, landing page, live dashboard polling, URL-synced filters, and Framer Motion as the motion primitive.
  - ARCHITECTURE.md stays unchanged — no backend changes means no architecture changes.
  - CLAUDE.md stays unchanged — that brief is about the refactor pass that already happened.

8.4. Run through the full app as each of the four demo roles. Note any visible regressions in a short review document at docs/ui_elevation_review.md. If you find any, open a short follow-up commit per issue — do not include "drive-by" fixes unrelated to this plan.

8.5. Bundle-size check: after adding framer-motion, run `npm run build` and note the output bundle sizes for the main routes. Document in docs/ui_elevation_review.md. If the landing page (/) bundle exceeds 250KB of JS (post-gzip), identify the culprit — framer-motion tree-shakes well, so this should not happen — and fix. Dynamic-import Framer Motion-heavy components if needed (e.g. the chain motif could be a dynamic import since it only renders above the fold once).

8.6. Commit a final "chore: UI elevation plan complete" summary commit touching only the plan doc if a summary is needed. Prefer NOT adding this commit if the doc was updated in 8.3.

Acceptance for Phase 8:
- npm run build, npm run typecheck, npm run test:e2e all pass.
- reduced-motion.spec.ts passes — the app works correctly for motion-averse users.
- Backend test suite (backend/pytest) still passes — it should, because we haven't touched the backend, but verify.
- A fresh `docker compose up --build` produces a working demo end-to-end.
- Bundle size for / is documented and within budget.

Stop. Report complete.

=============================================================================
GLOBAL NOTES FOR EVERY PHASE
=============================================================================

If you find a defect not covered by any phase and it is a one-line fix, fix it and note it in the commit message. If it is more than one line, DO NOT fix it. Add it to docs/ui_elevation_baseline.md under a "Deferred defects" section and keep moving.

If a phase's acceptance criteria reveal that an earlier phase shipped a regression, STOP, fix the earlier phase in place, and re-run the earlier phase's acceptance criteria before returning to the current phase. Do not pile forward work on a broken foundation.

If a phase takes significantly longer than expected, STOP and summarize where you are in the phase. Do not hack through to "done" with quality compromises — VeriFlow is a reference project and the quality bar is deliberate.

Framer Motion discipline:
- Every `motion.*` component with non-trivial animation must either use a named variant from frontend/lib/motion.ts OR use useMotionTransition() for its transition config. If you find yourself writing `transition={{ duration: 0.38 }}` inline, stop and add it to the vocabulary.
- Never call `animate()` imperatively when `animate` prop + variants would work. Imperative animation is reserved for cases where variants can't express the logic (e.g. the risk-score bar animating from a previous numeric value to a new one — that's a useMotionValue case).
- Every AnimatePresence block must have keyed children. If you see `<AnimatePresence>{show && <div>…</div>}</AnimatePresence>`, the div needs a key.
- No `layoutId` collisions. If you use shared-layout animations across components, namespace the layoutId clearly (e.g. "record-detail-risk-bar", not "bar").

The bar for this work is: after the final phase, a principal engineer evaluating the project for a senior frontend role should see a cutting-edge operations intelligence platform — not a competent admin tool with a serious backend. Motion should feel like part of the product's voice, not a layer of polish applied on top.

Start with Phase 0. Do not skip Phase 0 even though it is "just docs" — the audit is the contract for the rest of the plan.
