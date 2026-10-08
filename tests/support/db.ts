import { describe } from "vitest";

import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

// Integration suites use this instead of describe, so they're skipped (not
// failed) where no test database is configured
export const describeDb = process.env.TEST_DATABASE_URL
  ? describe
  : describe.skip;

// Every table the tests write to, children before parents
export async function resetDatabase() {
  await prisma.leaveApplication.deleteMany();
  await prisma.userMemory.deleteMany();
  await prisma.agentThread.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.document.deleteMany();
  // Reports point at managers, so clear those links before deleting
  await prisma.employee.updateMany({ data: { managerId: null } });
  await prisma.employee.deleteMany();
}

export const PASSWORD = "Test@12345";

// An HR admin, a manager who reports to her, and two of the manager's reports
export async function seedTeam() {
  const passwordHash = await hashPassword(PASSWORD);
  const base = { department: "Engineering", leaveBalance: 10, passwordHash };

  const admin = await prisma.employee.create({
    data: {
      ...base,
      id: "admin",
      name: "Admin",
      email: "admin@test.dev",
      role: "admin",
      department: "HR",
    },
  });
  const manager = await prisma.employee.create({
    data: {
      ...base,
      id: "manager",
      name: "Manager",
      email: "manager@test.dev",
      managerId: admin.id,
    },
  });
  const alice = await prisma.employee.create({
    data: {
      ...base,
      id: "alice",
      name: "Alice",
      email: "alice@test.dev",
      managerId: manager.id,
    },
  });
  const bob = await prisma.employee.create({
    data: {
      ...base,
      id: "bob",
      name: "Bob",
      email: "bob@test.dev",
      managerId: manager.id,
    },
  });

  return { admin, manager, alice, bob };
}

export async function balanceOf(id: string) {
  const employee = await prisma.employee.findUniqueOrThrow({ where: { id } });

  return employee.leaveBalance;
}
