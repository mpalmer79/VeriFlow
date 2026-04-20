import { DEMO_ACCOUNTS, DEMO_PASSWORD, expect, loginAs, test } from "./fixtures";

test.describe("auth and shell", () => {
  test("redirects unauthenticated dashboard visits to login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
  });

  test("admin sees the operations nav item after signing in", async ({ page }) => {
    await loginAs(page, "admin");
    await expect(page.getByRole("link", { name: /operations/i })).toBeVisible();
  });

  test("reviewer does not see the operations nav item", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(DEMO_ACCOUNTS.reviewer);
    await page.getByLabel(/password/i).fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(
      page.getByRole("navigation").getByRole("link", { name: /operations/i })
    ).toHaveCount(0);
  });
});
