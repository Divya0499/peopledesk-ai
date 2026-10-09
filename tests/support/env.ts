import { config } from "dotenv";

// has to run before lib/prisma.ts is imported
config({ path: ".env.test", quiet: true });

if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

// A fixed secret, so session code works without the real one
process.env.SESSION_SECRET ??= "test-secret-that-is-at-least-32-characters";
