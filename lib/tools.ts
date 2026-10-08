import { prisma } from "@/lib/prisma";
import { Prisma, type LeaveStatus } from "@/lib/generated/prisma/client";
import { withRetry } from "@/lib/retry";

export async function getLeaveBalance(userId: string) {
  console.log("getLeaveBalance called for:", userId);

  // Timed to compare with the agent's total: Date.now() rather than
  // console.time, whose global labels clash when requests overlap
  const startedAt = Date.now();

  // A read, so safe to retry if the database briefly fails
  const employee = await withRetry(() =>
    prisma.employee.findUnique({
      where: { id: userId },
    }),
  );

  console.log(`getLeaveBalance: ${Date.now() - startedAt}ms`);

  if (!employee) {
    return {
      userId,
      error: "Employee not found",
    };
  }

  return {
    userId,
    leaveBalance: employee.leaveBalance,
  };
}

export async function getEmployeeDetails(userId: string) {
  console.log("getEmployeeDetails called for:", userId);

  const employee = await prisma.employee.findUnique({
    where: { id: userId },
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
  };
}

type LeaveApplicationRecord = {
  userId: string;
  days: number;
  requestId: string;
  status: LeaveStatus;
};

// Rebuilds the response for a requestId that was already processed, so a
// retry gets the same answer without touching the balance again.
async function previousLeaveResult(application: LeaveApplicationRecord) {
  const employee = await prisma.employee.findUnique({
    where: { id: application.userId },
  });

  if (application.status === "rejected") {
    return {
      success: false,
      alreadyProcessed: true,
      error: "Insufficient leave balance",
      requestedDays: application.days,
      leaveBalance: employee?.leaveBalance,
      requestId: application.requestId,
    };
  }

  return {
    success: true,
    alreadyProcessed: true,
    userId: application.userId,
    days: application.days,
    remainingBalance: employee?.leaveBalance,
    requestId: application.requestId,
    message: `Leave application for ${application.days} day(s) was already submitted.`,
  };
}

// Enforces the leave rules itself rather than trusting Gemini to follow the
// system instruction. A valid request deducts the days from PostgreSQL.
// requestId makes it idempotent: repeating a requestId returns the first
// result instead of deducting the days again.
export async function applyLeave(
  userId: string,
  days: number,
  requestId: string,
) {
  console.log("applyLeave called:", userId, days, requestId);

  if (!Number.isInteger(days) || days <= 0) {
    return {
      success: false,
      error: "Days must be a positive whole number",
    };
  }

  const existing = await prisma.leaveApplication.findUnique({
    where: { requestId },
  });

  if (existing) {
    if (existing.userId !== userId || existing.days !== days) {
      return {
        success: false,
        error: "requestId was already used for a different leave request",
        requestId,
      };
    }

    return previousLeaveResult(existing);
  }

  const employee = await prisma.employee.findUnique({
    where: { id: userId },
  });

  if (!employee) {
    return {
      success: false,
      error: "Employee not found",
    };
  }

  try {
    // The balance check, deduction and application record commit together,
    // so a failure part-way can never leave days deducted without a record.
    return await prisma.$transaction(async (tx) => {
      // Checking the balance inside the update stops two concurrent requests
      // from both passing the check and overdrawing the balance.
      const deducted = await tx.employee.updateMany({
        where: { id: userId, leaveBalance: { gte: days } },
        data: { leaveBalance: { decrement: days } },
      });

      if (deducted.count === 0) {
        await tx.leaveApplication.create({
          data: { userId, days, requestId, status: "rejected" },
        });

        const current = await tx.employee.findUniqueOrThrow({
          where: { id: userId },
        });

        return {
          success: false,
          error: "Insufficient leave balance",
          requestedDays: days,
          leaveBalance: current.leaveBalance,
          requestId,
        };
      }

      await tx.leaveApplication.create({
        data: { userId, days, requestId, status: "approved" },
      });

      const updated = await tx.employee.findUniqueOrThrow({
        where: { id: userId },
      });

      return {
        success: true,
        userId,
        days,
        remainingBalance: updated.leaveBalance,
        requestId,
        message: `Leave application submitted for ${days} day(s).`,
      };
    });
  } catch (error) {
    // Another request with the same requestId committed first; the unique
    // constraint rolled this one back, so report that request's result.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const application = await prisma.leaveApplication.findUniqueOrThrow({
        where: { requestId },
      });
      return previousLeaveResult(application);
    }

    throw error;
  }
}
