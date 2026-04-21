import { expect, loginAs, test } from "./fixtures";

// Regression guard for the app-wide useReducedMotion contract.
// Playwright's `reducedMotion: "reduce"` option forwards
// `prefers-reduced-motion: reduce` to Chromium. Every Framer Motion
// call site is supposed to collapse to duration-0 state changes, so
// the test is: can we actually see the final rendered state on every
// major surface without waiting for a fade?

test.use({ reducedMotion: "reduce" });

test.describe("reduced motion", () => {
  test("landing page reaches final state without motion timing", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /process compliance/i, level: 1 }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /enter demo/i })).toBeVisible();
    // Three section headings (B/C/D) use whileInView — with reduced
    // motion they render immediately, not staggered.
    await expect(
      page.getByRole("heading", { name: /what it actually does/i }),
    ).toBeVisible();
  });

  test("dashboard KPI row renders immediately under reduced motion", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/dashboard");
    for (const label of ["Total records", "Blocked", "High or critical risk"]) {
      await expect(
        page.getByText(label, { exact: true }).first(),
      ).toBeVisible();
    }
    // LiveIndicator still renders. The chain-pulse dot is a CSS
    // animation (perpetual ambient), which reduced-motion disables
    // globally via app/globals.css — but the pill + label are still
    // visible.
    await expect(page.getByText(/^live$/i).first()).toBeVisible();
  });

  test("record detail panels are all visible under reduced motion", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/records");
    await page.getByRole("link", { name: "Casey Nguyen" }).click();
    for (const heading of [
      "Evaluation",
      "Workflow progress",
      "Document evidence",
      "Audit trail",
    ]) {
      await expect(
        page.getByRole("heading", { name: heading }),
      ).toBeVisible();
    }
    // aria-current="step" on the active timeline node is the structural
    // marker from Phase 4 — it must be present even when the ring
    // scale-in animation is skipped.
    await expect(
      page.locator('[aria-current="step"]').first(),
    ).toBeVisible();
  });
});
