import { expect, loginAs, test } from "./fixtures";

test.describe("typography + motion wiring", () => {
  test("html root carries the next/font variable classes", async ({ page }) => {
    await page.goto("/login");
    // next/font exposes the fonts as CSS custom-property variable classes
    // on whichever element we attach them to (we use <html>).
    const htmlClass = await page.locator("html").getAttribute("class");
    expect(htmlClass ?? "").toMatch(/__variable/);
  });

  test("login page animates in on first paint", async ({ page }) => {
    await page.goto("/login");
    const shell = page.locator("div.animate-page-in");
    await expect(shell).toBeVisible();
  });

  test("app shell fades its main area on route change", async ({ page }) => {
    await loginAs(page, "admin");
    // After login we're on /dashboard. Visit /records and check the main
    // wrapper still carries the fade-in class so route transitions are
    // smooth.
    await page.getByRole("link", { name: /records/i }).first().click();
    await expect(page).toHaveURL(/\/records/);
    await expect(page.locator("main.animate-fade-in")).toBeVisible();
  });
});
