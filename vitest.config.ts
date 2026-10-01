import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // Los cálculos de día/mes deben dar lo mismo sea cual sea la zona del entorno.
    env: { TZ: "America/New_York" },
  },
});
