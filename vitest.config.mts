import path from "node:path";
import { defineConfig } from "vitest/config";

// Unit tests need nothing. Integration tests use a real PostgreSQL database
// from TEST_DATABASE_URL; tests/support/global-setup.ts refuses to run them
// against a database whose name doesn't end in _test, so they can never
// wipe real data.
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
