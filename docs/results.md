Phase 8 is complete and pushed to `claude/veriflow-phase-0-1-fNDG6`.

**Summary of what landed:**
- `ConfirmDialog` component and its adoption in record-detail reject/delete flows
- `/operations` admin console wiring audit-chain verification, storage inventory, and dry-run/destructive orphan cleanup
- Seed gate (`SeedNotAllowedError` unless `APP_ENV` is dev-like or `VERIFLOW_ALLOW_SEED=true`)
- `/health/readiness` with a live DB ping returning 503 on failure
- Railway configs for both services + `docs/deployment.md`
- Playwright scaffolding (`playwright.config.ts`, smoke spec, nested tsconfig, npm scripts)
- README refresh and a new Phase 8 test file

**Verification:** 199/199 backend tests pass, `npm run type-check` clean, `next build` succeeds with `/operations` in the route manifest.
