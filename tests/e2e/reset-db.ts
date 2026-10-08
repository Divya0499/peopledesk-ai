import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../../lib/generated/prisma/client";

// Empties the test database before an e2e run (run by global-setup.ts, which
// has already checked the database name ends in _test)
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  await prisma.leaveApplication.deleteMany();
  await prisma.userMemory.deleteMany();
  await prisma.agentThread.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.document.deleteMany();
  await prisma.employee.updateMany({ data: { managerId: null } });
  await prisma.employee.deleteMany();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
