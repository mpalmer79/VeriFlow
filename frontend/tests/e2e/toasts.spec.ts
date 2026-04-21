import { expect, loginAs, test } from "./fixtures";

test.describe("toast notifications", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "admin");
  });

  test("an evaluation emits a toast that auto-dismisses", async ({ page }) => {
    await page.goto("/records");
    await page.getByRole("link", { name: "Casey Nguyen" }).click();
    await expect(
      page.getByRole("heading", { name: "Evaluation" }),
    ).toBeVisible();

    // "Run evaluation" appears both in the ActionBar (primary) and in
    // the EvaluationPanel empty state. Scope to the ActionBar region
    // so we always click the one the page intends as the action.
    const actionBar = page.getByRole("region", { name: /record actions/i });
    await actionBar.getByRole("button", { name: /^Run evaluation$/i }).click();

    const viewport = page.getByRole("region", { name: /notifications/i }).or(
      page.locator('[aria-label="Notifications"]'),
    );
    const toast = viewport.locator('[role="status"], [role="alert"]').first();
    await expect(toast).toBeVisible();
    await expect(toast).toContainText(/evaluation/i);
  });

  test("toast can be dismissed manually", async ({ page }) => {
    await page.goto("/records");
    await page.getByRole("link", { name: "Casey Nguyen" }).click();
    const actionBar = page.getByRole("region", { name: /record actions/i });
    await actionBar.getByRole("button", { name: /^Run evaluation$/i }).click();

    const viewport = page.locator('[aria-label="Notifications"]');
    const toast = viewport.locator('[role="status"], [role="alert"]').first();
    await expect(toast).toBeVisible();

    await toast.getByRole("button", { name: /dismiss notification/i }).click();
    await expect(toast).toBeHidden();
  });
});
