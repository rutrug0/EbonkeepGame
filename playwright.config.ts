import { defineConfig, devices } from "@playwright/test";

const apiPort = process.env.TEST_API_PORT ?? "4010";
const webPort = process.env.TEST_WEB_PORT ?? "4173";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${webPort}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  projects: [
    {
      name: "setup",
      testMatch: /setup\/auth\.setup\.ts/
    },
    {
      name: "smoke",
      grep: /@smoke/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/e2e/.auth/guest.json"
      }
    },
    {
      name: "nightly",
      grep: /@nightly/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/e2e/.auth/guest.json"
      }
    },
    {
      name: "mobile-nightly",
      grep: /@mobile/,
      dependencies: ["setup"],
      use: {
        ...devices["Pixel 5"],
        storageState: "tests/e2e/.auth/guest.json"
      }
    }
  ],
  webServer: [
    {
      command: "node tools/test/run-api.mjs",
      url: `http://127.0.0.1:${apiPort}/ready`,
      reuseExistingServer: !process.env.CI,
      stdout: "pipe",
      stderr: "pipe",
      timeout: 120_000
    },
    {
      command: "node tools/test/run-web.mjs",
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      stdout: "pipe",
      stderr: "pipe",
      timeout: 120_000
    }
  ]
});
