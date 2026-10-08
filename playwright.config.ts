import { config } from "dotenv";
import { defineConfig } from "@playwright/test";

// End-to-end tests drive a production build of the app in Chrome, against
// the test database (TEST_DATABASE_URL), on its own port so a running dev
// server is left alone. They cover the flows that don't call the AI model:
// login, roles, the leave workflow and employee management.
config({ path: ".env.test", quiet: true });

const PORT = 3200;
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error("Set TEST_DATABASE_URL (in .env.test or the environment)");
}

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "tests/e2e/global-setup.ts",
  // The tests share one database and change its data, so one at a time
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
    env: {
      DATABASE_URL: testDatabaseUrl,
      SESSION_SECRET:
        process.env.SESSION_SECRET ?? "e2e-secret-that-is-at-least-32-characters",
    },
  },
});
