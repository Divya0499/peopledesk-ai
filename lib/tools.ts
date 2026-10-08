import { prisma } from "@/lib/prisma";
import { withRetry } from "@/lib/retry";

export async function getLeaveBalance(userId: string) {
  console.log("getLeaveBalance called for:", userId);

  // Timed to compare with the agent's total: Date.now() rather than
  // console.time, whose global labels clash when requests overlap
  const startedAt = Date.now();

  // Reads, so safe to retry if the database briefly fails
  const [employee, pending] = await withRetry(() =>
    Promise.all([
      prisma.employee.findUnique({
        where: { id: userId },
      }),
      prisma.leaveApplication.aggregate({
        where: { userId, status: "pending" },
        _sum: { days: true },
      }),
    ]),
  );

  console.log(`getLeaveBalance: ${Date.now() - startedAt}ms`);

  if (!employee) {
    return {
      userId,
      error: "Employee not found",
    };
  }

  // leaveBalance already has pending requests taken off (see lib/leave.ts);
  // pendingDays says how many of the taken days are still waiting
  return {
    userId,
    leaveBalance: employee.leaveBalance,
    pendingDays: pending._sum.days ?? 0,
  };
}

export async function getEmployeeDetails(userId: string) {
  console.log("getEmployeeDetails called for:", userId);

  const employee = await prisma.employee.findUnique({
    where: { id: userId },
    include: { manager: { select: { name: true } } },
  });

  if (!employee) {
    return {
      error: "Employee not found",
    };
  }

  return {
    id: employee.id,
    name: employee.name,
    department: employee.department,
    leaveBalance: employee.leaveBalance,
    // Who approves their leave; HR when they have no manager
    leaveApprover: employee.manager?.name ?? "HR",
  };
}
