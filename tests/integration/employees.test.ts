import { beforeEach, expect, it } from "vitest";

import {
  createEmployee,
  createEmployeeSchema,
  updateEmployee,
  updateEmployeeSchema,
} from "@/lib/employees";
import { verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

import { describeDb, resetDatabase, seedTeam } from "../support/db";

const newEmployee = {
  name: "Tara",
  email: "  Tara@Test.dev ",
  department: "Engineering",
  role: "employee",
  managerId: "manager",
  leaveBalance: 24,
  password: "Welcome@123",
};

describeDb("employee management", () => {
  beforeEach(async () => {
    await resetDatabase();
    await seedTeam();
  });

  it("creates an employee with a normalised email and hashed password", async () => {
    const input = createEmployeeSchema.parse(newEmployee);
    const result = await createEmployee(input);

    expect(result.ok).toBe(true);

    const saved = await prisma.employee.findUniqueOrThrow({
      where: { email: "tara@test.dev" },
    });
    expect(saved.managerId).toBe("manager");
    expect(saved.passwordHash).not.toContain("Welcome@123");
    expect(await verifyPassword("Welcome@123", saved.passwordHash!)).toBe(true);
  });

  it("refuses a duplicate email, whatever its case", async () => {
    const input = createEmployeeSchema.parse({
      ...newEmployee,
      email: "ALICE@test.dev",
    });

    expect(await createEmployee(input)).toMatchObject({
      ok: false,
      status: 409,
    });
  });

  it("refuses a manager that doesn't exist", async () => {
    const input = createEmployeeSchema.parse({
      ...newEmployee,
      managerId: "nobody",
    });

    expect(await createEmployee(input)).toMatchObject({ status: 400 });
  });

  it("validates input before anything is saved", () => {
    const cases = [
      { email: "not-an-email" },
      { password: "short" },
      { leaveBalance: -1 },
      { leaveBalance: 2.5 },
      { name: "   " },
      { role: "owner" },
    ];

    for (const change of cases) {
      expect(
        createEmployeeSchema.safeParse({ ...newEmployee, ...change }).success,
      ).toBe(false);
    }
  });

  it("treats a blank manager as no manager", () => {
    const parsed = updateEmployeeSchema.parse({ managerId: "" });

    expect(parsed.managerId).toBeNull();
  });

  it("refuses a manager change that would make a reporting loop", async () => {
    // alice → manager → admin; making alice the admin's manager loops
    expect(
      await updateEmployee("admin", "admin", { managerId: "alice" }),
    ).toMatchObject({ ok: false, status: 400 });

    expect(
      await updateEmployee("admin", "alice", { managerId: "alice" }),
    ).toMatchObject({ ok: false, status: 400 });

    // Moving alice to report to bob is fine
    expect(
      await updateEmployee("admin", "alice", { managerId: "bob" }),
    ).toMatchObject({ ok: true });
  });

  it("won't let an admin remove their own admin role", async () => {
    expect(
      await updateEmployee("admin", "admin", { role: "employee" }),
    ).toMatchObject({ ok: false, status: 400 });

    const admin = await prisma.employee.findUniqueOrThrow({
      where: { id: "admin" },
    });
    expect(admin.role).toBe("admin");
  });

  it("resets a password only when a new one is given", async () => {
    const before = await prisma.employee.findUniqueOrThrow({
      where: { id: "bob" },
    });

    await updateEmployee("admin", "bob", { department: "Sales" });
    const unchanged = await prisma.employee.findUniqueOrThrow({
      where: { id: "bob" },
    });
    expect(unchanged.passwordHash).toBe(before.passwordHash);

    await updateEmployee("admin", "bob", { password: "Another@123" });
    const changed = await prisma.employee.findUniqueOrThrow({
      where: { id: "bob" },
    });
    expect(await verifyPassword("Another@123", changed.passwordHash!)).toBe(
      true,
    );
  });

  it("returns 404 for an unknown employee", async () => {
    expect(await updateEmployee("admin", "ghost", { name: "X" })).toMatchObject(
      { status: 404 },
    );
  });
});
