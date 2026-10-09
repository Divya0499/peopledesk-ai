import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../lib/generated/prisma/client";
import { hashPassword } from "../lib/password";

// demo users. upsert so it can be run again to reset them
const DEMO_PASSWORD = "PeopleDesk@123";

// Managers before their reports, so each managerId already exists
const employees = [
  {
    id: "user-123",
    name: "Asha Rao",
    email: "asha@peopledesk.dev",
    department: "Human Resources",
    role: "admin",
    managerId: null,
  },
  {
    id: "user-200",
    name: "Vikram Shah",
    email: "vikram@peopledesk.dev",
    department: "Engineering",
    role: "employee",
    managerId: "user-123",
  },
  {
    id: "user-456",
    name: "Neha Gupta",
    email: "neha@peopledesk.dev",
    department: "Engineering",
    role: "employee",
    managerId: "user-200",
  },
  {
    id: "user-789",
    name: "Rohan Das",
    email: "rohan@peopledesk.dev",
    department: "Engineering",
    role: "employee",
    managerId: "user-200",
  },
] as const;

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  for (const employee of employees) {
    const data = { ...employee, passwordHash, leaveBalance: 24 };

    await prisma.employee.upsert({
      where: { id: employee.id },
      update: data,
      create: data,
    });
  }

  console.log(`Seeded ${employees.length} employees`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
