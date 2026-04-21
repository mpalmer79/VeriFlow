import { expect, loginAs, test } from "./fixtures";

test.describe("dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "admin");
  });

  test("KPI hero row renders four cards with the expected labels", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    // Labels are always present in the DOM regardless of count values.
    for (const label of [
      "Total records",
      "In progress",
      "Blocked",
      "High or critical risk",
    ]) {
      await expect(
        page.getByText(label, { exact: true }).first(),
      ).toBeVisible();
    }
  });

  test("live indicator pill is present and announces live state", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    // aria-live="polite" region contains "Live" once the first fetch
    // completes. toBeVisible waits the default 5s so the background
    // fetch has time to resolve.
    await expect(page.getByText(/^live$/i).first()).toBeVisible();
  });

  test("manual refresh button still works alongside polling", async ({ page }) => {
    await page.goto("/dashboard");
    const refresh = page.getByRole("button", { name: /^Refresh$/i });
    await expect(refresh).toBeVisible();
    await refresh.click();
    // The click should not navigate; we remain on /dashboard.
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});


test.describe("records page filters", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "admin");
  });

  test("filters survive a URL reload via useSearchParams", async ({ page }) => {
    await page.goto("/records");
    // Pick the Blocked status filter via its aria-label; this writes
    // ?status=blocked to the URL.
    const statusFilter = page.getByLabel(/filter by status/i);
    await statusFilter.selectOption("blocked");
    await expect(page).toHaveURL(/\?status=blocked\b/);

    // Reload and confirm the select still reflects the URL-backed value.
    await page.reload();
    await expect(statusFilter).toHaveValue("blocked");
  });
});
