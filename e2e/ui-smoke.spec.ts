import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test("list → create → detail → comment → done", async ({ page }) => {
  await login(page);
  await page.goto("/");
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

test("queue page mentions telegram inbox", async ({ page }) => {
  await login(page);
  await page.goto("/queue");
  await expect(page.getByTestId("inbox-hint")).toBeVisible();
});
