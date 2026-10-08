import { execSync } from "node:child_process";

// Before the e2e run: an up-to-date schema and a clean, freshly seeded test
// database. Refuses any database whose name doesn't end in _test.
export default function globalSetup() {
  const url = process.env.TEST_DATABASE_URL!;
  const name = new URL(url).pathname.slice(1);

  if (!name.endsWith("_test")) {
    throw new Error(
      `Refusing to run e2e tests against "${name}": its name must end in _test`,
    );
  }

  const env = { ...process.env, DATABASE_URL: url };

  execSync("npx prisma migrate deploy", { stdio: "inherit", env });
  execSync("npx tsx tests/e2e/reset-db.ts", { stdio: "inherit", env });
  execSync("npx tsx prisma/seed.ts", { stdio: "inherit", env });
}
