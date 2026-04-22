import { expect, loginAs, test } from "./fixtures";

test.describe("landing page", () => {
  test("anonymous visitors see the hero, wordmark, and both CTAs", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /process compliance/i, level: 1 })
    ).toBeVisible();
    // Logomark + wordmark appear in the hero; checking the wordmark is
    // enough without coupling to SVG internals.
    await expect(
      page.getByRole("main").getByText("VeriFlow", { exact: true }).first()
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /enter demo/i })).toBeVisible();
    await expect(
      page.getByRole("link", { name: /see how it works/i })
    ).toBeVisible();
  });

  test('"Enter demo" links to /enter with the reviewer-auto param', async ({ page }) => {
    await page.goto("/");
    const cta = page.getByRole("link", { name: /enter demo/i });
    // The primary CTA auto-logs-in as the reviewer demo account and
    // deep-links to a blocked record; see frontend/app/enter/page.tsx.
    await expect(cta).toHaveAttribute("href", "/enter?auto=reviewer");
  });

  test('"See how it works" scrolls to the pillars section', async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /see how it works/i }).click();
    // Assert final DOM state, not timing.
    const pillars = page.locator("#pillars");
    await expect(pillars).toBeInViewport();
    await expect(
      page.getByRole("heading", { name: /what it actually does/i })
    ).toBeVisible();
  });

  test("authenticated visitors are redirected to /dashboard", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/");
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
