import { Prisma } from "@/lib/generated/prisma/client";
import type { LeaveStatus, UserRole } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";

// The leave workflow. Requesting leave reserves the days straight away (they
// come off leaveBalance) and leaves the request pending; the employee's
// manager then approves it, which keeps the days off, or rejects it, which
// gives them back. The employee can cancel a pending request, which also
// gives them back. Reserving up front means pending requests can never add
// up to more leave than the employee has.
//
// Every function enforces its own rules (who may act, which status a request
// must be in) rather than trusting the caller or the model.

export const MAX_REASON_LENGTH = 500;
export const MAX_NOTE_LENGTH = 500;

type RequestedLeave = {
  userId: string;
  days: number;
  requestId: string;
  status: LeaveStatus;
};

// Rebuilds the result for a requestId that was already used, so a retried
// request gets the same answer without reserving the days again
async function previousRequestResult(application: RequestedLeave) {
  const employee = await prisma.employee.findUnique({
    where: { id: application.userId },
    select: { leaveBalance: true },
  });

  return {
    success: true as const,
    alreadyProcessed: true,
    days: application.days,
    status: application.status,
    remainingBalance: employee?.leaveBalance,
    requestId: application.requestId,
    message: `This leave request for ${application.days} day(s) was already submitted.`,
  };
}

// Creates a pending request and reserves its days. requestId makes it
// idempotent: repeating one returns the first result instead of reserving
// the days again.
export async function requestLeave(
  userId: string,
  days: number,
  requestId: string,
  reason?: string,
) {
  if (!Number.isInteger(days) || days <= 0) {
    return {
      success: false as const,
      error: "Days must be a positive whole number",
    };
  }

  const trimmedReason = reason?.trim().slice(0, MAX_REASON_LENGTH) || null;

  const existing = await prisma.leaveApplication.findUnique({
    where: { requestId },
  });

  if (existing) {
    if (existing.userId !== userId || existing.days !== days) {
      return {
        success: false as const,
        error: "requestId was already used for a different leave request",
      };
    }

    return previousRequestResult(existing);
  }

  try {
    // The balance check, the reservation and the request commit together,
    // so days are never reserved without a request to show for them
    return await prisma.$transaction(async (tx) => {
      // Checking the balance inside the update stops two concurrent
      // requests from both passing the check and overdrawing it
      const reserved = await tx.employee.updateMany({
        where: { id: userId, leaveBalance: { gte: days } },
        data: { leaveBalance: { decrement: days } },
      });

      const employee = await tx.employee.findUnique({
        where: { id: userId },
        select: {
          leaveBalance: true,
          manager: { select: { name: true } },
        },
      });

      if (!employee) {
        return { success: false as const, error: "Employee not found" };
      }

      // Nothing was written, so a retry simply checks again
      if (reserved.count === 0) {
        return {
          success: false as const,
          error: "Insufficient leave balance",
          requestedDays: days,
          leaveBalance: employee.leaveBalance,
        };
      }

      await tx.leaveApplication.create({
        data: { userId, days, requestId, reason: trimmedReason },
      });

      const approver = employee.manager?.name ?? "HR";

      return {
        success: true as const,
        status: "pending" as const,
        days,
        remainingBalance: employee.leaveBalance,
        approver,
        requestId,
        message: `Leave request for ${days} day(s) sent to ${approver} for approval. The days are reserved until it's decided.`,
      };
    });
  } catch (error) {
    // Another request with the same requestId committed first; the unique
    // constraint rolled this one back, so report that request's result
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const application = await prisma.leaveApplication.findUniqueOrThrow({
        where: { requestId },
      });

      return previousRequestResult(application);
    }

    throw error;
  }
}

const requestSelect = {
  id: true,
  days: true,
  reason: true,
  status: true,
  createdAt: true,
  decidedAt: true,
  decisionNote: true,
  decidedBy: { select: { name: true } },
} satisfies Prisma.LeaveApplicationSelect;

// The employee's own requests, newest first
export async function listMyLeaveRequests(userId: string, take = 50) {
  return prisma.leaveApplication.findMany({
    where: { userId },
    select: requestSelect,
    orderBy: { createdAt: "desc" },
    take,
  });
}

type Approver = { userId: string; role: UserRole };

// Whose requests this person decides: their direct reports, plus, for an
// admin, everyone who has no manager. Never their own.
function approvableBy(approver: Approver): Prisma.EmployeeWhereInput {
  const reports: Prisma.EmployeeWhereInput = { managerId: approver.userId };

  const scope =
    approver.role === "admin"
      ? { OR: [reports, { managerId: null }] }
      : reports;

  return { AND: [scope, { id: { not: approver.userId } }] };
}

// Requests waiting for this person's decision, oldest first, so the longest
// waiting is handled first
export async function listPendingForApprover(approver: Approver) {
  return prisma.leaveApplication.findMany({
    where: { status: "pending", employee: approvableBy(approver) },
    select: {
      ...requestSelect,
      employee: {
        select: { id: true, name: true, department: true, leaveBalance: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

// Whether this person approves anyone's leave, to decide if they see the
// team approvals page
export async function isApprover(approver: Approver) {
  const count = await prisma.employee.count({ where: approvableBy(approver) });

  return count > 0;
}

export type DecisionResult =
  | { ok: true; status: LeaveStatus }
  | { ok: false; status: 403 | 404 | 409; error: string };

// Approves or rejects a pending request. Only the employee's manager (or an
// admin, for employees without one) may decide, and never on their own
// request. The status check is part of the update, so two people deciding
// at once can't both succeed, and a rejection's refund can only happen once.
export async function decideLeave(
  approver: Approver,
  applicationId: string,
  approve: boolean,
  note?: string,
): Promise<DecisionResult> {
  const application = await prisma.leaveApplication.findFirst({
    where: { id: applicationId, employee: approvableBy(approver) },
    select: { id: true, userId: true, days: true, status: true },
  });

  // Same answer for a request that doesn't exist and one this person can't
  // decide, so ids of other teams' requests can't be probed
  if (!application) {
    return { ok: false, status: 404, error: "Leave request not found" };
  }

  if (application.status !== "pending") {
    return {
      ok: false,
      status: 409,
      error: `This request was already ${application.status}`,
    };
  }

  const status: LeaveStatus = approve ? "approved" : "rejected";
  const decisionNote = note?.trim().slice(0, MAX_NOTE_LENGTH) || null;

  const decided = await prisma.$transaction(async (tx) => {
    const updated = await tx.leaveApplication.updateMany({
      where: { id: application.id, status: "pending" },
      data: {
        status,
        decidedById: approver.userId,
        decidedAt: new Date(),
        decisionNote,
      },
    });

    if (updated.count === 0) {
      return false;
    }

    // A rejection gives the reserved days back
    if (!approve) {
      await tx.employee.update({
        where: { id: application.userId },
        data: { leaveBalance: { increment: application.days } },
      });
    }

    return true;
  });

  if (!decided) {
    return {
      ok: false,
      status: 409,
      error: "This request was already decided",
    };
  }

  return { ok: true, status };
}

// The employee withdraws their own pending request; its days come back
export async function cancelLeave(
  userId: string,
  applicationId: string,
): Promise<DecisionResult> {
  const application = await prisma.leaveApplication.findFirst({
    where: { id: applicationId, userId },
    select: { id: true, days: true, status: true },
  });

  if (!application) {
    return { ok: false, status: 404, error: "Leave request not found" };
  }

  if (application.status !== "pending") {
    return {
      ok: false,
      status: 409,
      error: `Only pending requests can be cancelled; this one is ${application.status}`,
    };
  }

  const cancelled = await prisma.$transaction(async (tx) => {
    const updated = await tx.leaveApplication.updateMany({
      where: { id: application.id, status: "pending" },
      data: { status: "cancelled", decidedAt: new Date() },
    });

    if (updated.count === 0) {
      return false;
    }

    await tx.employee.update({
      where: { id: userId },
      data: { leaveBalance: { increment: application.days } },
    });

    return true;
  });

  if (!cancelled) {
    return {
      ok: false,
      status: 409,
      error: "This request was already decided",
    };
  }

  return { ok: true, status: "cancelled" };
}
