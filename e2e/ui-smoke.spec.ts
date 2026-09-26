import { test, expect } from "@playwright/test";

const API_KEY = process.env.BOOTSTRAP_API_KEY || "std_dev_bootstrap_key_change_me";

test("list → create → detail → comment → done", async ({ page }) => {
  await page.goto("/");
  await page.locator("#apiKey").fill(API_KEY);
  await page.locator("#apiKey").dispatchEvent("change");
  await page.reload();
  await page.locator("#apiKey").fill(API_KEY);
  await page.locator("#apiKey").dispatchEvent("change");

  const title = `PW ${Date.now()}`;
  await page.getByTestId("new-title").fill(title);
  await page.getByTestId("create-btn").click();
  await expect(page.getByTestId("issue-list")).toContainText(title);

  await page.locator('[data-testid^="issue-STD-"]').filter({ hasText: title }).first().click();
  await expect(page.getByTestId("status-select")).toBeVisible();
  await page.getByTestId("status-select").selectOption("in_progress");
  await page.getByTestId("comment-input").fill("playwright note");
  await page.getByTestId("comment-btn").click();
  await expect(page.getByTestId("comments")).toContainText("playwright note");
  await page.getByTestId("status-select").selectOption("done");
  await expect(page.getByTestId("status-select")).toHaveValue("done");
});
