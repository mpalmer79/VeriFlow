import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright runs against a live stack: backend on :8000 and frontend on
 * :3000. Locally the easiest path is `docker compose up` from the repo
 * root. In CI the `e2e` job in `.github/workflows/ci.yml` installs
 * dependencies, seeds SQLite, and launches both services in background
 * processes before invoking `npx playwright test --workers=1`.
 *
 * Chromium-only on purpose: the goal is a credible browser smoke, not a
 * matrix. Expanding to Firefox/WebKit would roughly double the job
 * runtime without meaningfully widening the coverage VeriFlow needs.
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
