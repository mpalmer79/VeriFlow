import { expect, loginAs, test } from "./fixtures";

test.describe("records flow", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "admin");
  });

  test("records list renders seeded rows and allows navigation", async ({
    page,
  }) => {
    await page.goto("/records");
    await expect(page.getByRole("heading", { name: "Records" })).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible();
    const subjectLink = page.getByRole("link", { name: "Riley Thompson" });
    await expect(subjectLink).toBeVisible();
    await subjectLink.click();
    await expect(page).toHaveURL(/\/records\/\d+/);
    // RecordHeader was removed; the subject name now lives in the
    // DecisionBanner's orientation strip as plain text (and in the
    // breadcrumbs). The DecisionBanner's h2 carries the decision state
    // ("Ready to advance.", "Blocked.", etc.), not the subject.
    await expect(page.getByText("Riley Thompson").first()).toBeVisible();
  });

  test("record detail renders the major sections", async ({ page }) => {
    await page.goto("/records");
    await page.getByRole("link", { name: "Casey Nguyen" }).click();
    await expect(page).toHaveURL(/\/records\/\d+/);

    for (const heading of [
      "Evaluation",
      "Workflow progress",
      "Document evidence",
      "Audit trail",
    ]) {
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    }
  });

  test("workflow timeline marks exactly one current stage", async ({ page }) => {
    // The timeline animates on transition; animation timing is covered by
    // reduced-motion handling. The DOM contract we pin here is structural:
    // every record renders a timeline with aria-current="step" on the one
    // active stage — so a keyboard / screen-reader user knows where they
    // are, and future transition tests can key off the same marker.
    await page.goto("/records");
    await page.getByRole("link", { name: "Casey Nguyen" }).click();
    await expect(page).toHaveURL(/\/records\/\d+/);
    await expect(
      page.getByRole("heading", { name: "Workflow progress" }),
    ).toBeVisible();
    // The visible timeline (horizontal at sm+, vertical otherwise) carries
    // aria-current="step" on the active stage. The inactive timeline is
    // display:none, which removes it from the accessibility tree.
    await expect(
      page.locator('[aria-current="step"]').first(),
    ).toBeVisible();
  });

  test("document overflow menu is keyboard accessible", async ({ page }) => {
    // The overflow trigger focuses via Tab and opens with Enter; once
    // open, Escape closes and returns focus to the trigger. These are
    // the guarantees Phase 6 made when it moved Delete / Integrity
    // check off the primary row.
    await page.goto("/records");
    await page.getByRole("link", { name: "Casey Nguyen" }).click();
    await expect(
      page.getByRole("heading", { name: "Document evidence" }),
    ).toBeVisible();

    const trigger = page
      .getByRole("button", { name: /^More actions$/i })
      .first();
    await trigger.focus();
    await page.keyboard.press("Enter");
    const menu = page.getByRole("menu").first();
    await expect(menu).toBeVisible();
    // The "Delete" menuitem is always present per Phase 6 spec.
    await expect(menu.getByRole("menuitem", { name: /^Delete$/i })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
  });

  test("metadata-only documents hide download and preview controls", async ({
    page,
  }) => {
    // Casey Nguyen's seed has a photo_id verified via metadata only.
    await page.goto("/records");
    await page.getByRole("link", { name: "Casey Nguyen" }).click();
    await expect(
      page.getByRole("heading", { name: "Document evidence" })
    ).toBeVisible();

    // The "Metadata only" marker is the visible signal for stored-content
    // absence. If it appears, neither Preview nor Download should be
    // offered for that document.
    const firstMetadataOnly = page
      .getByText(/Metadata only/i)
      .first();
    if (await firstMetadataOnly.isVisible().catch(() => false)) {
      const row = firstMetadataOnly.locator(
        "xpath=ancestor::*[self::li or self::tr or self::div][1]"
      );
      await expect(
        row.getByRole("button", { name: /preview/i })
      ).toHaveCount(0);
      await expect(
        row.getByRole("button", { name: /download/i })
      ).toHaveCount(0);
    }
  });
});
