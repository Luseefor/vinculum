import { defineConfig, devices } from "@playwright/test";

const defaultBaseUrl = "http://127.0.0.1:3100";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? defaultBaseUrl;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "on-first-retry"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ],
  webServer: {
    command: "next dev -p 3100",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  }
});
