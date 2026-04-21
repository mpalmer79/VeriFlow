# VeriFlow Design System

Design system for **VeriFlow** — a workflow and evidence-control platform for
compliance-heavy operations. This folder pins the visual language, tone, and
UI building blocks that ship in production today so future design work stays
on-brand without re-deriving everything from the codebase.

## Sources

Everything here is derived from the VeriFlow repository. These are the files
of record:

- **Repo:** https://github.com/mpalmer79/VeriFlow
- **Tailwind tokens:** `frontend/tailwind.config.ts`
- **Theme tokens (light + dark):** `frontend/app/theme.css`
- **Global CSS, fonts, flash-suppression:** `frontend/app/globals.css`, `frontend/app/layout.tsx`
- **Theme provider + persisted toggle:** `frontend/components/theme/ThemeProvider.tsx`, `frontend/components/theme/ThemeToggle.tsx`
- **Motion vocabulary:** `frontend/lib/motion.ts`
- **Landing page (hero, pillars, live demo panel):** `frontend/app/page.tsx`
- **Logomark:** `frontend/components/ui/Logomark.tsx`
- **Chain motif:** `frontend/components/landing/ChainMotif.tsx`
- **Record detail (the heart of the app):** `frontend/components/record-detail/**`
- **Icon barrel:** `frontend/components/icons/index.ts`
- **Product framing & copy tone:** repo `README.md`, `docs/product_overview.md`
- **Phase plan for light theme + token migration (landed on main):** `CLAUDE.md`

No Figma file was supplied. If one exists, add it above.

---

## What VeriFlow is

VeriFlow enforces staged progression against a code-driven rule registry,
scores operational risk, and produces a tamper-evident audit trail plus a
verifiable evidence chain. The engine is domain-agnostic; the reference
scenario is a nine-stage healthcare intake workflow, but the same data
model handles loan intake, vendor onboarding, and claims triage.

The product surface is a single Next.js web application with four core
areas:

1. **Landing page (`/`)** — marketing surface with a live `SeverityPanel`
   demo and an animated hash-chain motif.
2. **Dashboard (`/dashboard`)** — operations overview: KPI cards with
   count-up animation, a 30s visibility-gated poll with LIVE/STALE pill,
   and a `Needs attention` table.
3. **Records (`/records`, `/records/[id]`)** — list + detail. The detail
   page is the product's center of gravity: header, action bar,
   evaluation panel (risk bar + blocking/warning severity panels),
   workflow timeline, document evidence, and an append-only audit trail.
4. **Operations (`/operations`)** — admin-only audit-chain verification,
   managed-storage inventory, and bounded orphan cleanup.

The product is **one surface, one audience** — compliance operators,
reviewers, and admins. There is no mobile app, no marketing site separate
from the product; `/` is the marketing page and every other route lives in
the same Next.js app.

---

## Content fundamentals

**Voice.** Direct, technical, operator-facing. No second-person marketing
sparkle; the product talks the way engineers write commit messages — a
little clipped, precise about what's guaranteed vs. what isn't. The repo
README opens with *"VeriFlow is a workflow and evidence-control platform
for compliance-heavy operations"*; that register holds across UI copy.

**Casing.** Sentence case for headings, labels, buttons. ALL CAPS only for
field micro-labels (`CURRENT STAGE`, `RISK SCORE`) and the LIVE/STALE
indicator pill. Never title case.

**Person.** Mostly third-person and imperative. Buttons say *"Run
evaluation"*, *"Attempt transition"*, *"Refresh"*. Empty states describe
the situation rather than addressing the user: *"No evaluation on file"*,
*"Nothing needs attention"*, *"No blocking issues. All block-level rules
passed."* "You" appears rarely, mostly in dialog confirmations.

**Emoji.** None. Zero. Iconography is always Lucide line icons.

**Specificity over hype.** Copy tells the operator what's true, not how
they should feel. Examples lifted from the codebase:

- Landing hero tagline: *"Process compliance you can prove."*
- Pillar: *"Every domain event writes an append-only row whose hash
  chains to the one before it. Break a link and the verify endpoint
  says so."*
- Empty state on a clean severity panel: *"No blocking issues. All
  block-level rules passed."*
- Stale data pill: *"Stale"* (single word). Never "data might be out of
  date" or similar hedging.
- Tooltip on record version field: *"Incremented on every state change.
  Used to prevent conflicting edits via optimistic concurrency."*

**Identifier discipline.** Any string that's meaningful as a fixed-width
artifact — SHA-256 hashes, audit IDs, rule codes like
`insurance.status_known`, external references, `v{n}` version tags — is
rendered in JetBrains Mono via the `.mono` utility. Rule codes are
clickable and copy to clipboard.

**Numbers.** Tabular numerals everywhere by default
(`font-variant-numeric: tabular-nums` on `body`). Numeric columns align on
the decimal without extra work. Proportional numerals must be opted back
in explicitly for prose.

---

## Visual foundations

### Color

VeriFlow ships **two themes** — a light theme (the current default) and a
dark theme (the original product look, preserved). Theme switching is
driven by a `data-theme` attribute on `<html>`, set by a flash-suppression
script in `app/layout.tsx` that resolves `localStorage → prefers-color-scheme
→ "light"` before React hydrates. The user-facing control lives in
`components/theme/ThemeToggle.tsx` and persistence is handled by
`components/theme/ThemeProvider.tsx`.

Every surface/text/brand/status color resolves to a CSS custom property
defined in `frontend/app/theme.css`. Tailwind binds to those tokens via
`rgb(var(--color-xxx) / <alpha-value>)`, so flipping `data-theme`
re-skins the app without touching a single component class string.

**Light theme (default).** Warm off-white page (`250 250 249`), pure-white
elevated surfaces with hairline borders, stone-warm muted/sunken
backgrounds. Text is a deep warm black (`28 25 23`). Shadows stay soft
(opacity ~0.04–0.12) and borders do most of the elevation work.

**Dark theme.** Deep navy stack: page `#0b1220` → panel `#0f172a` →
sunken `#111c33`, with a single hairline border at `#1f2a44`. This is the
pre-Phase-5 look, preserved deliberately.

**Brand.** A 9-stop teal ramp (`brand-50`…`brand-900`) shared across both
themes in *name* but tuned in value: slightly deeper mid-range on light
(so `brand-500` / `brand-600` pass AA on white), slightly lighter on dark
(so the same tokens read against navy). `brand-600` is the primary CTA
background in both themes; `brand-300` is the hero headline highlight.

**Accent blue.** `#3b82f6` (strong `#2563eb`) is reserved for links and
in-progress chips so brand teal stays associated with action.

**Status palette.** Four theme-aware roles — `danger`, `warning`,
`success`, `info` — each with matched `bg` and `border` variants tuned
for AA contrast against the theme's elevated surface. Used for toasts,
banners, and form validation states.

**Severity.** A four-step ramp (`low` green → `moderate` amber → `high`
orange → `critical` red) held at fixed hex values across both themes —
the domain semantics carry meaning that shouldn't shift with theme.
Evidence status uses two further colors: `verified` teal-green (`#14b8a6`)
and `rejected` burnt amber (`#b45309`).

### Type
**Three families, three jobs.** Fraunces (serif, variable `opsz` +
`SOFT`) for display — headlines, subject names, KPI numerals, risk
scores. Inter for body and UI. JetBrains Mono for identifiers. All three
loaded via `next/font/google` with `display: swap` and bound to CSS
variables (`--font-sans`, `--font-mono`, `--font-display`).

### Spacing & radii
Tailwind's native scale (`gap-3`, `py-2.5`, `px-4` etc.) — no custom
spacing. Radii are moderate: `md` (8px) for chips, inputs, buttons;
`lg` (12px) for panels and cards; `xl` (16px) for the occasional larger
container. Pills are full-rounded only for status dots, the LIVE pill,
and risk chips.

### Backgrounds
**No full-bleed photography.** No generic stock imagery. The only
decoration on the landing hero is the `--gradient-hero` wash (a soft
brand-50 → white diagonal in light mode, brand-900 → page-bg in dark), a
**2% SVG noise overlay** (`.textured`), and two animated chain motifs
drawn in SVG. Everything else is flat surfaces with hairline borders.

### Gradients
Used sparingly and centralized. Exactly **three** gradient slots are
defined as tokens in `theme.css`, with per-theme overrides:

- `--gradient-hero` — radial/linear wash behind the landing headline.
- `--gradient-cta` (and `--gradient-cta-hover`) — primary CTA fill.
- `--gradient-accent-ring` — the active-stage ring on the workflow timeline.

If a fourth use shows up, we are over-using the accent. Every gradient
flows brand-teal-to-brand-teal; cross-hue gradients are not part of the
vocabulary.

### Animation
Framer Motion is the single motion primitive. Every animated call site
consults `useReducedMotion()` and collapses to instant when the user
prefers reduced motion. `globals.css` adds a belt-and-braces media query
that clamps all animations to 1ms under `prefers-reduced-motion`.

Durations are named: `DURATION_MICRO 0.12s`, `DURATION_SHORT 0.22s`,
`DURATION_MEDIUM 0.38s`, `DURATION_LONG 0.62s`. Two springs —
`SPRING_DEFAULT` (stiffness 300 / damping 30) and `SPRING_SOFT` (180 /
26). Custom easing curve `EASE_OUT_EXPO = [0.22, 1, 0.36, 1]`.

Motion vocabulary — fades rise 6–12px on entry; stagger children at
25–40ms; `AnimatePresence` with `mode="popLayout"` for list reflow; no
bouncy springs on data; no parallax; no scroll-linked animation; no
hover animations on every button. The `chain-pulse` keyframe (scale +
opacity, 3s ease-in-out, infinite) is used exclusively on the LIVE dot
and the `blocked` status dot.

### Hover & press
Hover lifts color, never adds shadow. Buttons shift border or background
one step (`hover:bg-brand-500` on `brand-600`; `hover:border-text-subtle`
on secondary). Anchors in copy use `hover:underline`. Press state is a
1px translate-Y on buttons (`active:translate-y-px`) — no scale-shrink.

### Borders & shadows
Borders do most of the elevation work. Every panel is `border
border-surface-border` on `bg-surface-panel`, padded `p-4`–`p-6`, radius
`lg` (12px). Shadows are theme-scaled: soft on light
(`shadow-md ≈ 0 2px 6px rgb(0 0 0 / 0.08)`), deeper on dark
(`shadow-md ≈ 0 2px 6px rgb(0 0 0 / 0.45)`), and used only where
elevation is semantically meaningful — the explainability demo card
(`shadow-lg`) and the toast stack. No inner shadows. No colored shadows.

### Transparency & blur
Used thinly. Severity fills are tinted at `/15` alpha
(`bg-severity-critical/15`). Risk bars fill solid with a `18% opacity`
trailing wash. Backdrop blur is not used anywhere in the current surface.

### Corner radii recap
- `rounded-md` (8px): buttons, inputs, chips, toast, severity cards
- `rounded-lg` (12px): panels, hero demo card
- `rounded-xl` (16px): occasional oversized container
- `rounded-full`: status dots, LIVE pill, risk chips, stage nodes
- Square (`rounded-[2px]`): terminal-state stage nodes (`blocked`,
  `closed`) — their shape distinguishes them from in-flight stages.

### Cards
A card in VeriFlow is a `border border-surface-border` on
`bg-surface-panel`, padded `p-4`–`p-6`, radius `lg` (12px). KPI cards sit
flat-on-flat with a `field-label` caps micro-label, a Fraunces display
numeral, and an optional icon in the top-right at reduced opacity. The
"highlighted" variant replaces the border color with the tone color
(`border-severity-critical/60` when a blocked count is non-zero).

---

## Iconography

VeriFlow uses **[lucide-react](https://lucide.dev/)** exclusively, imported
through a single named-export barrel at
`frontend/components/icons/index.ts`. Default stroke weight is `1.5–2`,
sizes `14–28px`. The actively-used set is small:

```
Activity, AlertOctagon, AlertTriangle, ArrowRight, Check, ChevronRight,
Circle, CircleCheck, CircleDot, Clock, Copy, ExternalLink, FileCheck2,
FileX2, Fingerprint, Link2, Loader2, MoreHorizontal, RefreshCw, ShieldCheck
```

See `assets/lucide-icons.html` for the preview of every one.

Two **bespoke SVG icons** ship with the brand and are not from Lucide:

1. **Logomark** (`assets/logomark.svg`) — two interlocking chevrons
   drawn on a 32×32 grid. The right chevron overshoots upward on its
   return leg so the tail reads as a check mark. The codebase animates
   it once per session (left chevron draws, right chevron follows 120ms
   later) via `pathLength` interpolation.
2. **Chain motif** (`assets/chain-motif.svg`) — five open ellipses,
   `42×18` each, `26px` pitch. On the landing hero, each link pulses
   through `pathLength 0 → 1 → 0` with a 0.42s stagger so the chain
   "reads" left to right continuously. Used twice on the hero, once
   per side, at `opacity 0.3`–`0.4` as an ambient background detail.

**Emoji: never.** **Unicode glyphs: never** (not for arrows, bullets, or
checks). **Photography: never.** **Illustration beyond the two bespoke
SVGs: never.**

Public assets in the repo (`frontend/public/`) are empty in main — no
favicon yet, no OG image, no product screenshots committed. If you are
producing marketing artifacts, the Logomark + ChainMotif + brand
gradient wash is the full visual library.

---

## Repository layout

```
.
├── README.md                  this file
├── SKILL.md                   Agent-skills-compatible entry point
├── colors_and_type.css        CSS variables — both themes, type, radii, shadows
├── assets/
│   ├── logomark.svg           bespoke brand mark
│   ├── chain-motif.svg        animated hash-chain motif (static source)
│   ├── imagery.html           visual inventory of brand motifs + gradients
│   └── lucide-icons.html      visual inventory of every Lucide icon in use
├── fonts/                     webfont sources (Google Fonts subset; see note)
├── preview/                   individual design-system cards
├── ui_kits/
│   └── veriflow_web/          high-fidelity JSX recreation of the product
│       ├── index.html         interactive click-through of core screens
│       ├── README.md          kit map
│       └── components/*.jsx   factored pieces (Button, KPICard, Panel, …)
```

Slides are not included because no slide deck was provided.

---

## Font note

The VeriFlow frontend loads **Inter**, **JetBrains Mono**, and **Fraunces**
via `next/font/google` at runtime — there are no TTFs checked into the
repo. For offline / HTML artifact work, we reference the same families
from Google Fonts CDN in `colors_and_type.css` consumers. If you need to
ship actual font files, pull the corresponding subsets from
https://fonts.google.com/ (the Next.js loader uses weights 400/500/600/700
for Inter and Fraunces and 400/500 for JetBrains Mono; Fraunces is
loaded as a variable font on the `opsz` and `SOFT` axes).

> **Flagged for review:** the TTFs are not vendored. If the brand
> requires self-hosted fonts, drop the files into `fonts/` and wire the
> `@font-face` rules.

---

## Index

- [`SKILL.md`](./SKILL.md) — how agents should invoke this system.
- [`colors_and_type.css`](./colors_and_type.css) — CSS custom properties, both themes.
- [`preview/`](./preview/) — individual system cards.
- [`assets/logomark.svg`](./assets/logomark.svg),
  [`assets/chain-motif.svg`](./assets/chain-motif.svg),
  [`assets/lucide-icons.html`](./assets/lucide-icons.html).
- [`ui_kits/veriflow_web/`](./ui_kits/veriflow_web/) — React UI kit.
