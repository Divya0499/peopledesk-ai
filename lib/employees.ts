import { z } from "zod";

import { Prisma } from "@/lib/generated/prisma/client";
import { hashPassword, MIN_PASSWORD_LENGTH } from "@/lib/password";
import { prisma } from "@/lib/prisma";

const MAX_LEAVE_DAYS = 365;

const fields = {
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter a valid email address")),
  department: z.string().trim().min(1, "Department is required").max(100),
  role: z.enum(["employee", "admin"]),
  // "" = no manager
  managerId: z
    .string()
    .nullish()
    .transform((value) => value || null),
  leaveBalance: z
    .number(`Leave balance must be a number`)
    .int(`Leave balance must be a whole number`)
    .min(0, `Leave balance must be between 0 and ${MAX_LEAVE_DAYS}`)
    .max(
      MAX_LEAVE_DAYS,
      `Leave balance must be between 0 and ${MAX_LEAVE_DAYS}`,
    ),
  password: z
    .string()
    .min(
      MIN_PASSWORD_LENGTH,
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    )
    .max(200),
};

export const createEmployeeSchema = z.object(fields);

export const updateEmployeeSchema = z.object(fields).partial();

export type EmployeeResult =
  | { ok: true; id: string }
  | { ok: false; status: 400 | 404 | 409; error: string };

const employeeSelect = {
  id: true,
  name: true,
  email: true,
  department: true,
  role: true,
  leaveBalance: true,
  managerId: true,
  manager: { select: { name: true } },
  _count: { select: { reports: true } },
} satisfies Prisma.EmployeeSelect;

export async function listEmployees() {
  return prisma.employee.findMany({
    select: employeeSelect,
    orderBy: { name: "asc" },
  });
}

// A manages B manages A - walk up the chain from the new manager
async function createsManagerLoop(employeeId: string, managerId: string) {
  let current: string | null = managerId;
  const seen = new Set<string>();

  while (current && !seen.has(current)) {
    if (current === employeeId) {
      return true;
    }

    seen.add(current);

    const next: { managerId: string | null } | null =
      await prisma.employee.findUnique({
        where: { id: current },
        select: { managerId: true },
      });

    current = next?.managerId ?? null;
  }

  return false;
}

async function managerExists(managerId: string) {
  const count = await prisma.employee.count({ where: { id: managerId } });

  return count > 0;
}

function isUniqueEmailError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export async function createEmployee(
  input: z.infer<typeof createEmployeeSchema>,
): Promise<EmployeeResult> {
  if (input.managerId && !(await managerExists(input.managerId))) {
    return { ok: false, status: 400, error: "That manager doesn't exist" };
  }

  try {
    const { password, ...data } = input;
    const employee = await prisma.employee.create({
      data: { ...data, passwordHash: await hashPassword(password) },
      select: { id: true },
    });

    return { ok: true, id: employee.id };
  } catch (error) {
    if (isUniqueEmailError(error)) {
      return {
        ok: false,
        status: 409,
        error: "An employee with that email already exists",
      };
    }

    throw error;
  }
}

export async function updateEmployee(
  adminId: string,
  employeeId: string,
  input: z.infer<typeof updateEmployeeSchema>,
): Promise<EmployeeResult> {
  const existing = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true },
  });

  if (!existing) {
    return { ok: false, status: 404, error: "Employee not found" };
  }

  // don't let an admin remove their own admin role
  if (employeeId === adminId && input.role && input.role !== "admin") {
    return {
      ok: false,
      status: 400,
      error: "You can't remove your own admin role",
    };
  }

  if (input.managerId) {
    if (input.managerId === employeeId) {
      return {
        ok: false,
        status: 400,
        error: "An employee can't be their own manager",
      };
    }

    if (!(await managerExists(input.managerId))) {
      return { ok: false, status: 400, error: "That manager doesn't exist" };
    }

    if (await createsManagerLoop(employeeId, input.managerId)) {
      return {
        ok: false,
        status: 400,
        error: "That manager reports to this employee, which would make a loop",
      };
    }
  }

  try {
    const { password, ...data } = input;

    await prisma.employee.update({
      where: { id: employeeId },
      data: {
        ...data,
        ...(password && { passwordHash: await hashPassword(password) }),
      },
    });

    return { ok: true, id: employeeId };
  } catch (error) {
    if (isUniqueEmailError(error)) {
      return {
        ok: false,
        status: 409,
        error: "An employee with that email already exists",
      };
    }

    throw error;
  }
}

export function firstIssue(error: z.ZodError) {
  return error.issues[0]?.message ?? "Invalid input";
}
