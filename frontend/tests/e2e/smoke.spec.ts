import { expect, test } from "@playwright/test";

/**
 * Baseline smoke tests. These assume the demo seed has been applied
 * (see tests/e2e/README.md). They exercise the unauthenticated routes
 * and a single happy-path login so regressions in the shell are caught
 * before individual feature suites start reporting cascading failures.
 */

test.describe("login flow", () => {
  test("redirects unauthenticated dashboard visits to login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
  });

  test("logs in as admin and lands on the dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill("admin@veriflow.demo");
    await page.getByLabel(/password/i).fill("VeriFlow!2025");
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(
      page.getByRole("link", { name: /operations/i })
    ).toBeVisible();
  });
});
