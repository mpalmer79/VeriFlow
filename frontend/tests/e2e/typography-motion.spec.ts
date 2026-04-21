import { expect, loginAs, test } from "./fixtures";

test.describe("typography + motion wiring", () => {
  test("html root carries the next/font variable classes", async ({ page }) => {
    await page.goto("/login");
    // next/font exposes the fonts as CSS custom-property variable classes
    // on whichever element we attach them to (we use <html>). Phase 1
    // added a third (display) variable so the regex stays satisfied and
    // gains a count assertion so a future removal is caught.
    const htmlClass = await page.locator("html").getAttribute("class");
    expect(htmlClass ?? "").toMatch(/__variable/);
    const variables = (htmlClass ?? "").match(/__variable/g) ?? [];
    expect(variables.length).toBeGreaterThanOrEqual(3);
  });

  test("login page enters cleanly on first paint", async ({ page }) => {
    // Phase 7 replaced the 1600ms CSS animate-page-in fade with a short
    // Framer Motion fadeRise entrance. The Playwright contract is now
    // "the form reaches its final visible state after the entrance"
    // rather than "a specific class is present". toBeVisible waits out
    // the spring, so this is the right assertion for motion-driven
    // state.
    await page.goto("/login");
    await expect(
      page.getByRole("heading", { name: /sign in/i })
    ).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
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
