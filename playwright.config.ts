import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3044",
    trace: "on-first-retry",
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : [
        {
          command: "bash scripts/ensure-e2e-db.sh && npm run dev:api",
          url: "http://127.0.0.1:3042/v1/health",
          reuseExistingServer: false,
          timeout: 60_000,
          env: {
            ...process.env,
            PORT: "3042",
            AGENT_MODE: "mock",
            EXPOSE_UI_KEY: "0",
            COOKIE_SECURE: "0",
            LOGIN_USER: process.env.LOGIN_USER || "cz",
            LOGIN_PASSWORD: process.env.LOGIN_PASSWORD || "strawtodo-local",
            BOOTSTRAP_API_KEY: process.env.BOOTSTRAP_API_KEY || "std_dev_bootstrap_key_change_me",
            DATABASE_URL:
              process.env.E2E_DATABASE_URL ||
              "postgres://strawtodo:strawtodo@127.0.0.1:5433/strawtodo_e2e",
            CORS_ORIGIN: "http://127.0.0.1:3044",
          },
        },
        {
          command: "npm run dev:e2e -w @strawtodo/web",
          url: "http://127.0.0.1:3044",
          reuseExistingServer: false,
          timeout: 60_000,
          env: {
            ...process.env,
            VITE_API_PROXY: "http://127.0.0.1:3042",
          },
        },
      ],
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
