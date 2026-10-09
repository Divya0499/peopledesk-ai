import path from "node:path";
import { defineConfig } from "vitest/config";

// integration tests need TEST_DATABASE_URL (name must end in _test)
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname),
      // Next.js makes this throw outside the server build; in tests the
      // whole process is "the server", so it's a no-op
      "server-only": path.resolve(
        import.meta.dirname,
        "node_modules/server-only/empty.js",
      ),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    globalSetup: ["tests/support/global-setup.ts"],
    setupFiles: ["tests/support/env.ts"],
    // Integration tests share one database, so files run one at a time
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
