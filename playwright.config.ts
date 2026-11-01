import { defineConfig } from "@playwright/test";

// Serves the exported site the way GitHub Pages will: from a folder called /how.
export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  use: { baseURL: "http://localhost:8124", viewport: { width: 1440, height: 900 } },
  webServer: { command: "node scripts/serve-export.mjs", port: 8124, reuseExistingServer: true },
});
