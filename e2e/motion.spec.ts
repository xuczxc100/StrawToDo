import { test, expect } from "@playwright/test";
import { login } from "./helpers";

async function hasCssRule(page: import("@playwright/test").Page, needle: string) {
  return page.evaluate((sel) => {
    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRuleList;
      try {
        rules = sheet.cssRules;
      } catch {
        continue;
      }
      for (const rule of Array.from(rules)) {
        if (rule.cssText.includes(sel)) return true;
      }
    }
    return false;
  }, needle);
}

test("login card appear + page/chip/row transitions", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByTestId("login-form")).toBeVisible();
  expect(await hasCssRule(page, ".page-enter-active")).toBeTruthy();
  expect(await hasCssRule(page, ".chip-enter-active")).toBeTruthy();
  expect(await hasCssRule(page, ".row-enter-active")).toBeTruthy();
  expect(await hasCssRule(page, ".login-enter-active")).toBeTruthy();
  expect(await hasCssRule(page, "prefers-reduced-motion")).toBeTruthy();

  await login(page);
  await page.goto("/board");
  const title = `Anim ${Date.now()}`;
  await page.getByTestId("new-title").fill(title);
  await page.getByTestId("create-btn").click();
  await expect(page.getByTestId("board")).toContainText(title);
  await expect(page.locator(".chip").filter({ hasText: title })).toBeVisible();

  await page.locator("a.nav[href='/']").click();
  await expect(page.getByTestId("issue-list")).toContainText(title, { timeout: 8_000 });
  await page.locator("a.nav[href='/queue']").click();
  await expect(page.getByTestId("queue-list")).toContainText(title, { timeout: 8_000 });
  await page.locator("a.nav[href='/board']").click();
  await expect(page.getByTestId("board")).toContainText(title, { timeout: 8_000 });
});

test("390px login + board still usable with motion", async ({ page }) => {
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
