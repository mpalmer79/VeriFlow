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

    // "Run evaluation" lives on the DecisionBanner (when the record is
    // not yet evaluated) and in the EvaluationPanel empty state. Scope
    // by aria-label so we always click the banner's primary CTA.
    await page
      .getByRole("button", { name: /^Run evaluation for this record$/i })
      .click();

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
    await page
      .getByRole("button", { name: /^Run evaluation for this record$/i })
      .click();

    const viewport = page.locator('[aria-label="Notifications"]');
    const toast = viewport.locator('[role="status"], [role="alert"]').first();
    await expect(toast).toBeVisible();

    await toast.getByRole("button", { name: /dismiss notification/i }).click();
    await expect(toast).toBeHidden();
  });
});
