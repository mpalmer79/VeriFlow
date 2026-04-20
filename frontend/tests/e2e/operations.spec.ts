import { expect, loginAs, test } from "./fixtures";

test.describe("operations admin", () => {
  test("admin reaches the operations console and sees the three panels", async ({
    page,
  }) => {
    await loginAs(page, "admin");
    await page.getByRole("link", { name: /operations/i }).click();

    await expect(page).toHaveURL(/\/operations/);
    await expect(
      page.getByRole("heading", { name: "Operations" })
    ).toBeVisible();
    for (const heading of [
      "Audit chain",
      "Storage inventory",
      "Orphan cleanup",
    ]) {
      await expect(
        page.getByRole("heading", { name: heading })
      ).toBeVisible();
    }

    // Dry-run action is always available; destructive button is disabled
    // when there are no orphans (fresh seed).
    await expect(
      page.getByRole("button", { name: /run dry-run report/i })
    ).toBeEnabled();
  });

  test("non-admin is shown the admin-required empty state", async ({ page }) => {
    await loginAs(page, "reviewer");
    await page.goto("/operations");
    await expect(
      page.getByText(/admin access required/i)
    ).toBeVisible();
  });
});
