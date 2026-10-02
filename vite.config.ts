import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { preflightExecuteBridge } from "./src/server/execute-bridge.js";

export default defineConfig({
  plugins: [react(), preflightExecuteBridge()],
  build: { outDir: "dist" },
});
