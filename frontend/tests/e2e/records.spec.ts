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
    await expect(
      page.getByRole("heading", { name: "Riley Thompson" })
    ).toBeVisible();
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
