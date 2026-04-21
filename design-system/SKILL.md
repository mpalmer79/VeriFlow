---
name: veriflow-design
description: Use this skill to generate well-branded interfaces and assets for VeriFlow, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the `README.md` file within this skill, and explore the other available
files. The root-level files are the source of truth:

- `README.md` — product context, content fundamentals, visual foundations, iconography
- `colors_and_type.css` — every token as a CSS variable
- `assets/` — logomark, chain motif, Lucide icon inventory
- `preview/` — individual Design System cards
- `ui_kits/veriflow_web/` — JSX recreation of dashboard, records, record detail, and operations

If creating visual artifacts (slides, mocks, throwaway prototypes, etc),
copy the relevant assets out and create static HTML files for the user to
view. Link `colors_and_type.css` directly — do not re-declare the token
palette. Reuse components from `ui_kits/veriflow_web/components/` when the
prototype resembles the product.

If working on production code, treat this folder as the design brief:
the tokens here mirror `frontend/tailwind.config.ts` in the VeriFlow
repo, and the rules laid out in `README.md` (no emoji, Fraunces for
display + KPIs, Inter for UI, JetBrains Mono for identifiers, single
teal brand, four-step severity ramp, Lucide icons only) are non-negotiable.

If the user invokes this skill without any other guidance, ask them what
they want to build or design, ask some questions, and act as an expert
designer who outputs HTML artifacts _or_ production code, depending on
the need.
