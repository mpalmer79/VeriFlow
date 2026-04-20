import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright groundwork for VeriFlow.
 *
 * These tests run against a live stack: backend on :8000 and frontend on
 * :3000. The easiest way to bring that stack up is `docker compose up`
 * from the repo root, which runs migrations and seeds the demo org. Once
 * both services report ready, run `npm run test:e2e` from this directory.
 *
 * CI intentionally does not run Playwright yet. That decision is revisited
 * once the suite has enough coverage to justify the additional runtime.
 */

const FRONTEND_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: FRONTEND_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
