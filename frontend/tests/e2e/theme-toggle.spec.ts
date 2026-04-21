import { expect, test } from "./fixtures";

test.describe("theme toggle", () => {
  test("keyboard arrows switch the radiogroup selection", async ({ page }) => {
    await page.goto("/");
    const group = page.getByRole("radiogroup", { name: /theme/i }).first();
    await expect(group).toBeVisible();

    const light = page.getByRole("radio", { name: /light theme/i }).first();
    const dark = page.getByRole("radio", { name: /dark theme/i }).first();

    // Focus the radiogroup, then arrow keys switch the active option.
    await group.focus();
    // Start from light (Phase 6 default). Arrow Right moves to dark.
    await page.keyboard.press("ArrowRight");
    await expect(dark).toHaveAttribute("aria-checked", "true");
    await expect(light).toHaveAttribute("aria-checked", "false");

    await page.keyboard.press("ArrowLeft");
    await expect(light).toHaveAttribute("aria-checked", "true");
    await expect(dark).toHaveAttribute("aria-checked", "false");
  });

  test("theme preference persists across reload", async ({ page, context }) => {
    await context.clearCookies();
    await page.goto("/");

    // Flip to dark.
    await page
      .getByRole("radio", { name: /dark theme/i })
      .first()
      .click();
    await expect(
      page.locator("html"),
    ).toHaveAttribute("data-theme", "dark");

    // Reload and confirm the theme survives.
    await page.reload();
    await expect(
      page.locator("html"),
    ).toHaveAttribute("data-theme", "dark");
    // The toggle reflects the persisted preference.
    await expect(
      page.getByRole("radio", { name: /dark theme/i }).first(),
    ).toHaveAttribute("aria-checked", "true");
  });
});
