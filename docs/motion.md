# VeriFlow — Motion presets

Phase 5 introduced a frozen record of named motion presets in
`frontend/lib/motion.ts`. Each preset is a single-component bundle
(`initial` / `animate` / optional `exit` / `transition`) so call
sites can say `useMotionPreset("slideUp")` and splat the result into
a `motion.div` instead of repeating the shape.

The earlier named variants (`fadeRise`, `fadeRiseSlow`, `overlayFade`,
`dialogPop`, `staggerParent`, `staggerParentTight`) stay intact.
They are the right tool when a parent drives children via `variants`.
Presets target the single-component case.

## When to use

| Preset | Intent | Reduced motion |
|--------|--------|----------------|
| `fadeRise` | Standard mount entrance. 6px vertical rise + fade via the house spring. Use for rows, panels, and other surfaces that should feel alive on first paint. | `transition: { duration: 0 }` — element appears at its final state on mount. |
| `fadeRiseSlow` | Slower-gradient entrance for hero-weight surfaces (landing sections, dashboard hero). 12px rise + fade via `DURATION_MEDIUM` + `EASE_OUT_EXPO`. | Instant. |
| `slideUp` | Reveal from below with a symmetric exit upward. Good for toasts, inline notifications, expanding disclosure content. | Instant. |
| `slideDown` | Mirror of `slideUp` for top-anchored surfaces (dropdown headers, alert banners). | Instant. |
| `scaleIn` | Pop an element in from 95% scale, fade in together. Use on popovers, menus, small tooltips where the trigger is the anchor. | Instant. |
| `dialogPop` | Modal dialogs. 8px rise + scale 0.98 → 1 + fade, symmetric exit. Pairs with `AnimatePresence` mode="wait" around backdrop + dialog. | Instant. |
| `overlayFade` | Backdrops, empty states, anything that should feel *present* without movement. Pure opacity fade. | Instant. |
| `listStagger` | Parent variant for staggered child reveals (table rows, issue lists). The children still need their own entrance variants; `listStagger` only schedules them. | Instant — the stagger collapses to 0ms between children. |

## Reduced motion

Every preset is delivered through `useMotionPreset(name)`, which
consults `useReducedMotion()`. When the user requests reduced motion:

- `initial` / `animate` / `exit` shapes are preserved (so Framer
  Motion knows what "final state" means).
- `transition` becomes `{ duration: 0 }`, which makes Framer Motion
  jump straight to `animate` without interpolating.

The net effect: motion-averse users see the same final DOM the rest
of the app sees, with no transform interpolation or opacity ramps.
Tests in `frontend/tests/e2e/reduced-motion.spec.ts` are the
regression guard.

## Example

```tsx
"use client";

import { motion } from "framer-motion";

import { useMotionPreset } from "@/lib/motion";

export function ExpandableRow({ open, children }: { open: boolean; children: React.ReactNode }) {
  const preset = useMotionPreset("slideUp");
  return open ? <motion.div {...preset}>{children}</motion.div> : null;
}
```

## Adding a new preset

1. Pick a name that describes intent, not mechanics
   (`scaleIn`, not `scale95to100`). The motion vocabulary is a
   product language.
2. Keep the transition values centralized — import `SPRING_DEFAULT`,
   `DURATION_*`, or `EASE_OUT_EXPO` rather than inlining magic
   numbers.
3. Add a row to the table above.
4. If the preset is used by more than two surfaces, add a Playwright
   assertion under reduced motion so the duration-0 degradation is
   pinned.
