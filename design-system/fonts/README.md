# VeriFlow webfonts

The production codebase loads Inter, JetBrains Mono, and Fraunces via
`next/font/google` — no TTFs are vendored in the repo. For consistency
this design system also pulls fonts from Google Fonts CDN rather than
self-hosting.

If self-hosted fonts are required, download from:
- Inter: https://fonts.google.com/specimen/Inter (weights 400/500/600/700)
- JetBrains Mono: https://fonts.google.com/specimen/JetBrains+Mono (400/500)
- Fraunces: https://fonts.google.com/specimen/Fraunces (variable, axes opsz + SOFT)

**Flagged for review** — if you want self-hosted fonts, drop TTFs into
this folder and ping the design-system owner to wire `@font-face`.
