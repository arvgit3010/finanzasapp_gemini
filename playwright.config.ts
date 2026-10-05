import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";
import { rmSync } from "node:fs";
const db = resolve("test-results/e2e.sqlite");
rmSync(db, { force: true });
rmSync(db + "-wal", { force: true });
rmSync(db + "-shm", { force: true });
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  use: { baseURL: "http://127.0.0.1:3140", trace: "retain-on-failure" },
  webServer: {
    command: "npm start",
    url: "http://127.0.0.1:3140/api/health",
    reuseExistingServer: false,
    env: {
      PORT: "3140",
      FRONTEND_ORIGIN: "http://127.0.0.1:3140",
      DATABASE_PATH: db,
    },
  },
  projects: [
    {
      name: "desktop",
      use: { browserName: "chromium", viewport: { width: 1440, height: 1000 } },
    },
  ],
});
