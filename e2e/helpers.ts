import type { Page } from "@playwright/test";

export const LOGIN_USER = process.env.LOGIN_USER || "cz";
export const LOGIN_PASSWORD = process.env.LOGIN_PASSWORD || "strawtodo-local";

export async function login(page: Page) {
  await page.goto("/login");
  await page.getByTestId("login-user").fill(LOGIN_USER);
  await page.getByTestId("login-pass").fill(LOGIN_PASSWORD);
  await page.getByTestId("login-btn").click();
  await page.getByTestId("board").or(page.getByTestId("issue-list")).waitFor({ timeout: 10_000 });
}
