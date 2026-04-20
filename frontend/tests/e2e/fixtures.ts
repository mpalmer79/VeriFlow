import { expect, test as base, Page } from "@playwright/test";

export const DEMO_PASSWORD = "VeriFlow!2025";

export const DEMO_ACCOUNTS = {
  admin: "admin@veriflow.demo",
  intake: "intake@veriflow.demo",
  reviewer: "reviewer@veriflow.demo",
  manager: "manager@veriflow.demo",
} as const;

export type DemoRole = keyof typeof DEMO_ACCOUNTS;

export async function loginAs(page: Page, role: DemoRole): Promise<void> {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(DEMO_ACCOUNTS[role]);
  await page.getByLabel(/password/i).fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

export const test = base;
export { expect };
