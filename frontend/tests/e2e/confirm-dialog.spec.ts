import { expect, loginAs, test } from "./fixtures";

test.describe("confirm dialog behavior", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "admin");
  });

  test("delete action opens a confirm dialog and cancel closes it", async ({
    page,
  }) => {
    // Phase 6.4 moved Delete behind the document row's overflow menu so
    // the row's primary actions stay focused on Preview / Download /
    // Verify / Reject. The flow is otherwise identical: open the
    // overflow menu, choose Delete, the same ConfirmDialog appears.
    await page.goto("/records");
    await page.getByRole("link", { name: "Casey Nguyen" }).click();
    await expect(
      page.getByRole("heading", { name: "Document evidence" })
    ).toBeVisible();

    await page
      .getByRole("button", { name: /^More actions$/i })
      .first()
      .click();
    await page
      .getByRole("menuitem", { name: /^Delete$/i })
      .first()
      .click();

    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    // The confirm button inside the dialog is the destructive one.
    const confirmBtn = dialog.getByRole("button", { name: /^Delete/i });
    await expect(confirmBtn).toBeVisible();

    await dialog.getByRole("button", { name: /^Cancel$/i }).click();
    await expect(dialog).toBeHidden();
  });

  test("Escape key closes the confirm dialog", async ({ page }) => {
    await page.goto("/records");
    await page.getByRole("link", { name: "Casey Nguyen" }).click();
    await page
      .getByRole("button", { name: /^More actions$/i })
      .first()
      .click();
    await page
      .getByRole("menuitem", { name: /^Delete$/i })
      .first()
      .click();

    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });
});
