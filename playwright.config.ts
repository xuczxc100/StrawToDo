import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3041",
    trace: "on-first-retry",
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : [
        {
          command: "npm run dev:api",
          url: "http://127.0.0.1:3040/v1/health",
          reuseExistingServer: true,
          timeout: 60_000,
          env: {
            ...process.env,
            PORT: "3040",
            AGENT_MODE: "mock",
            EXPOSE_UI_KEY: "1",
            BOOTSTRAP_API_KEY: process.env.BOOTSTRAP_API_KEY || "std_dev_bootstrap_key_change_me",
            DATABASE_URL:
              process.env.DATABASE_URL ||
              "postgres://strawtodo:strawtodo@127.0.0.1:5433/strawtodo",
            CORS_ORIGIN: "http://localhost:3041",
          },
        },
        {
          command: "npm run dev:web",
          url: "http://127.0.0.1:3041",
          reuseExistingServer: true,
          timeout: 60_000,
        },
      ],
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
