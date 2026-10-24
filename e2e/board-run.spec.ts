import { test, expect } from "@playwright/test";

const API_KEY = process.env.BOOTSTRAP_API_KEY || "std_dev_bootstrap_key_change_me";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/board");
  await page.locator("#apiKey").fill(API_KEY);
  await page.locator("#apiKey").dispatchEvent("change");
}

test("board create → run → in review", async ({ page }) => {
  await login(page);
  const title = `Board ${Date.now()}`;
  await page.getByTestId("new-title").fill(title);
  await page.getByTestId("create-btn").click();
  await expect(page.getByTestId("board")).toContainText(title);
  await page.locator('[data-testid^="issue-STD-"]').filter({ hasText: title }).first().click();
  await expect(page.getByTestId("run-btn")).toBeVisible();
  await page.getByTestId("run-btn").click();
  await expect(page.getByTestId("status-select")).toHaveValue("in_review", { timeout: 15_000 });
  await expect(page.getByTestId("comments")).toContainText("測試通過");
  await expect(page.getByTestId("run-log")).toBeVisible();
});

test("390px board has no horizontal page overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await expect(page.getByTestId("board")).toBeVisible();
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return { sw: doc.scrollWidth, cw: doc.clientWidth };
  });
  expect(overflow.sw).toBeLessThanOrEqual(overflow.cw + 1);
});
