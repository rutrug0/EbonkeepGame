import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    setupFiles: ["./test/setup.ts"],
    fileParallelism: false,
    hookTimeout: 120_000,
    testTimeout: 120_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"]
    }
  }
});
