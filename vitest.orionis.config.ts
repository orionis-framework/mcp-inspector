import { defineConfig } from "vitest/config";

// Explicit integration suite: ordinary unit tests remain independent of Python.
export default defineConfig({
  test: {
    include: ["tests/integration/**/*.integration.ts"],
    environment: "node",
    hookTimeout: 20_000,
    testTimeout: 10_000,
  },
});
