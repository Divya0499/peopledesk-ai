import { execSync } from "node:child_process";

import { config } from "dotenv";

// Runs once before all tests: brings the test database's schema up to date.
// Refuses any database whose name doesn't end in _test, because the
// integration tests delete every row they touch.
export default function setup() {
  config({ path: ".env.test", quiet: true });

  const url = process.env.TEST_DATABASE_URL;

  if (!url) {
    console.warn(
      "TEST_DATABASE_URL is not set: integration tests will be skipped.",
    );
    return;
  }

  const name = new URL(url).pathname.slice(1);

  if (!name.endsWith("_test")) {
    throw new Error(
      `Refusing to run tests against "${name}": the test database's name must end in _test`,
    );
  }

  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url },
  });
}
