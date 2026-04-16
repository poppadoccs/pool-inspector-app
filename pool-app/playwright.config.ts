import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3001",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // Port 3001 — isolated from the dev server on 3000.
    // reuseExistingServer: false guarantees a fresh process with mock scan enabled,
    // regardless of whether a dev server is already running.
    command: "next dev -p 3001",
    url: "http://localhost:3001",
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      USE_MOCK_FORM_SCAN: "true",
    },
  },
});
