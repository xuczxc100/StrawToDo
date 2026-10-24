import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test("board create → run → in review", async ({ page }) => {
  await login(page);
  await page.goto("/board");
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
  await page.goto("/board");
  await expect(page.getByTestId("board")).toBeVisible();
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return { sw: doc.scrollWidth, cw: doc.clientWidth };
  });
  expect(overflow.sw).toBeLessThanOrEqual(overflow.cw + 1);
});

test("wrong password stays on login", async ({ page }) => {
  await page.goto("/login");
  await page.getByTestId("login-user").fill("cz");
  await page.getByTestId("login-pass").fill("wrong-password");
  await page.getByTestId("login-btn").click();
  await expect(page.getByTestId("login-error")).toBeVisible();
  await expect(page).toHaveURL(/login/);
});
