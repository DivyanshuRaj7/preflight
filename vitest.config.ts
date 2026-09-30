import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    // Playwright browser specs live here but run only via `npm run test:e2e`.
    exclude: ["**/node_modules/**", "**/dist/**", "tests/e2e/**"],
  },
});
