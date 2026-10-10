import { Prisma } from "@/lib/generated/prisma/client";
import type { LeaveStatus, UserRole } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";

// days are taken off the balance when the leave is requested, and given back
// if it's rejected or cancelled. that way pending requests can't go over the balance

export const MAX_REASON_LENGTH = 500;
export const MAX_NOTE_LENGTH = 500;

export const NO_APPROVER_ERROR =
  "No one can approve this leave yet: you don't have a manager and there's no other admin. An admin can assign you a manager on the Employees page.";

type RequestedLeave = {
  userId: string;
  days: number;
  requestId: string;
  status: LeaveStatus;
};

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

// requestId = idempotency key, same id twice returns the first result
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
    return await prisma.$transaction(async (tx) => {
      // someone has to be able to decide it (see approvableBy): their manager,
      // or for people without one, an admin other than themselves. otherwise
      // the days would stay reserved on a request no one can approve
      const requester = await tx.employee.findUnique({
        where: { id: userId },
        select: { managerId: true },
      });

      if (!requester) {
        return { success: false as const, error: "Employee not found" };
      }

      if (!requester.managerId) {
        const otherAdmins = await tx.employee.count({
          where: { role: "admin", id: { not: userId } },
        });

        if (otherAdmins === 0) {
          return { success: false as const, error: NO_APPROVER_ERROR };
        }
      }

      // check the balance in the update itself so parallel requests can't overdraw it
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
    // same requestId was saved by another request at the same time
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

export async function listMyLeaveRequests(userId: string, take = 50) {
  return prisma.leaveApplication.findMany({
    where: { userId },
    select: requestSelect,
    orderBy: { createdAt: "desc" },
    take,
  });
}

type Approver = { userId: string; role: UserRole };

// direct reports, and for admins also people without a manager. never yourself
function approvableBy(approver: Approver): Prisma.EmployeeWhereInput {
  const reports: Prisma.EmployeeWhereInput = { managerId: approver.userId };

  const scope =
    approver.role === "admin"
      ? { OR: [reports, { managerId: null }] }
      : reports;

  return { AND: [scope, { id: { not: approver.userId } }] };
}

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

export async function isApprover(approver: Approver) {
  const count = await prisma.employee.count({ where: approvableBy(approver) });

  return count > 0;
}

export type DecisionResult =
  | { ok: true; status: LeaveStatus }
  | { ok: false; status: 403 | 404 | 409; error: string };

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

  // 404 for both "doesn't exist" and "not yours"
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
    // status: "pending" in the where so two decisions at once can't both go through
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
