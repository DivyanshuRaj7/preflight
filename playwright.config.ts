import { defineConfig } from "@playwright/test";

// TASK-005B browser layer. Chromium only, headless by default
// (`--headed` for local debugging). The Vite dev server starts
// automatically — no manual server step before `npm run test:e2e`.
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5220",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    // Direct node invocation (not `npm run dev`): avoids shell-shim issues
    // so the server starts identically on every machine. --host pins the
    // IPv4 loopback because Vite otherwise binds localhost (IPv6 here)
    // while the poll below targets 127.0.0.1.
    command: "node node_modules/vite/bin/vite.js --port 5220 --strictPort --host 127.0.0.1",
    url: "http://127.0.0.1:5220/",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  outputDir: "test-results",
});
