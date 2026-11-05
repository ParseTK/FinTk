import { defineConfig, devices } from "@playwright/test";

/**
 * Browser smoke tests: the real website in front of the real API and database, with an invented
 * data vendor (backend/scripts/e2e_server.py), so no key, no network and no real vendor data.
 *
 * Needs a built site (`npm run build`) and a migrated Postgres (VIRELLO_DATABASE_URL, or
 * backend/.env). Ports can be changed so a run never collides with a development server:
 *   E2E_API_PORT=8100 E2E_WEB_PORT=3100 npm run e2e
 */
const api = process.env.E2E_API_PORT ?? "8000";
const web = process.env.E2E_WEB_PORT ?? "3000";

export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.e2e.ts",
  // One database, one signed-in person: the tests run in order, not side by side.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: `http://localhost:${web}`, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "uv run python -m scripts.e2e_server",
      cwd: "../backend",
      url: `http://127.0.0.1:${api}/healthz`,
      env: {
        E2E_API_PORT: api,
        // The API only accepts state-changing requests from its own website.
        VIRELLO_CORS_ORIGINS: `http://localhost:${web}`,
        VIRELLO_PUBLIC_URL: `http://localhost:${web}`,
      },
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: `npx next start -p ${web}`,
      url: `http://localhost:${web}/`,
      env: {
        API_URL: `http://127.0.0.1:${api}`,
        FEATURE_AUTH: "true",
        FEATURE_CRYPTO: "true",
        FEATURE_CRYPTO_MARKETS: "true",
        FEATURE_CRYPTO_SEARCH: "true",
        FEATURE_HOLDINGS: "true",
        FEATURE_RESOURCES: "true",
        // News reads live government feeds; the smoke tests stay off the network.
        FEATURE_CRYPTO_NEWS: "false",
      },
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
