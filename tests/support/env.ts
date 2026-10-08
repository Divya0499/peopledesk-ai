import { config } from "dotenv";

// Runs in every test file before anything is imported. lib/prisma.ts reads
// DATABASE_URL when it's first imported, so point it at the test database
// here. .env.test (optional, git-ignored) can set TEST_DATABASE_URL locally;
// CI sets it directly.
config({ path: ".env.test", quiet: true });

if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

// A fixed secret, so session code works without the real one
process.env.SESSION_SECRET ??= "test-secret-that-is-at-least-32-characters";
