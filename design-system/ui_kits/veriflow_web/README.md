# VeriFlow Web — UI kit

A high-fidelity click-through recreation of the VeriFlow web app. Four
core screens are reachable through a global nav:

1. **Dashboard** — KPI cards, LIVE/STALE header pill, Needs attention table.
2. **Records** — list with filters, risk chips, stage badges.
3. **Record detail** — the product's center of gravity: header, evaluation
   panel (blocking/warning severity), 9-stage timeline, evidence list,
   audit trail.
4. **Operations** — audit-chain verification, managed-storage inventory.

## Files

- `index.html` — loads React + Babel + all components; mounts the app.
- `components/App.jsx` — app shell, top nav, routing.
- `components/Dashboard.jsx` — dashboard screen.
- `components/Records.jsx` — records list + filters.
- `components/RecordDetail.jsx` — detail page (header, evaluation, timeline, evidence, audit).
- `components/Operations.jsx` — ops/admin screen.
- `components/Primitives.jsx` — `Button`, `Panel`, `Badge`, `RiskChip`,
  `FieldLabel`, `Icon`, `Toast`.
- `components/data.js` — mocked records, rules, audit rows.

No implementations are production — these are cosmetic/interactive
recreations. The source of truth for visual decisions is the VeriFlow
repo's `frontend/` folder.
