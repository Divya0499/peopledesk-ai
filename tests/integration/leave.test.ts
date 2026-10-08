import { beforeEach, expect, it } from "vitest";

import {
  cancelLeave,
  decideLeave,
  isApprover,
  listPendingForApprover,
  requestLeave,
} from "@/lib/leave";
import { prisma } from "@/lib/prisma";

import { balanceOf, describeDb, resetDatabase, seedTeam } from "../support/db";

describeDb("leave workflow", () => {
  let team: Awaited<ReturnType<typeof seedTeam>>;
  const managerUser = { userId: "manager", role: "employee" as const };
  const adminUser = { userId: "admin", role: "admin" as const };

  beforeEach(async () => {
    await resetDatabase();
    team = await seedTeam();
  });

  async function pendingId(userId: string) {
    const application = await prisma.leaveApplication.findFirstOrThrow({
      where: { userId, status: "pending" },
    });

    return application.id;
  }

  it("reserves the days and sends the request to the manager", async () => {
    const result = await requestLeave(team.alice.id, 3, "r1", "Trip");

    expect(result).toMatchObject({
      success: true,
      status: "pending",
      approver: "Manager",
      remainingBalance: 7,
    });
    expect(await balanceOf("alice")).toBe(7);

    const saved = await prisma.leaveApplication.findUniqueOrThrow({
      where: { requestId: "r1" },
    });
    expect(saved).toMatchObject({ days: 3, reason: "Trip", status: "pending" });
  });

  it("reserves only once when the same request is retried", async () => {
    await requestLeave("alice", 3, "r1");
    const retry = await requestLeave("alice", 3, "r1");

    expect(retry).toMatchObject({ success: true, alreadyProcessed: true });
    expect(await balanceOf("alice")).toBe(7);
    expect(await prisma.leaveApplication.count()).toBe(1);
  });

  it("refuses to reuse a request id for a different request", async () => {
    await requestLeave("alice", 3, "r1");

    expect(await requestLeave("alice", 4, "r1")).toMatchObject({
      success: false,
    });
    expect(await requestLeave("bob", 3, "r1")).toMatchObject({
      success: false,
    });
    expect(await balanceOf("bob")).toBe(10);
  });

  it("refuses more days than the balance and writes nothing", async () => {
    const result = await requestLeave("alice", 11, "r1");

    expect(result).toMatchObject({
      success: false,
      error: "Insufficient leave balance",
      leaveBalance: 10,
    });
    expect(await prisma.leaveApplication.count()).toBe(0);
  });

  it("rejects days that aren't a positive whole number", async () => {
    for (const days of [0, -2, 1.5, Number.NaN]) {
      expect(await requestLeave("alice", days, `r${days}`)).toMatchObject({
        success: false,
      });
    }
    expect(await balanceOf("alice")).toBe(10);
  });

  it("never overdraws when requests arrive at the same time", async () => {
    // 10 days available; five concurrent 3-day requests can't all fit
    const results = await Promise.all(
      [1, 2, 3, 4, 5].map((n) => requestLeave("alice", 3, `c${n}`)),
    );

    const accepted = results.filter((result) => result.success).length;

    expect(accepted).toBe(3);
    expect(await balanceOf("alice")).toBe(1);
  });

  it("lets the manager approve, keeping the days off", async () => {
    await requestLeave("alice", 3, "r1");
    const id = await pendingId("alice");

    expect(await decideLeave(managerUser, id, true, "Enjoy")).toEqual({
      ok: true,
      status: "approved",
    });

    const saved = await prisma.leaveApplication.findUniqueOrThrow({
      where: { id },
    });
    expect(saved).toMatchObject({
      status: "approved",
      decidedById: "manager",
      decisionNote: "Enjoy",
    });
    expect(await balanceOf("alice")).toBe(7);
  });

  it("gives the days back when the manager rejects", async () => {
    await requestLeave("alice", 3, "r1");

    await decideLeave(managerUser, await pendingId("alice"), false);

    expect(await balanceOf("alice")).toBe(10);
  });

  it("only lets the employee's own manager decide", async () => {
    await requestLeave("alice", 3, "r1");
    const id = await pendingId("alice");

    // A teammate, the employee herself, and an admin who isn't her manager
    for (const approver of [
      { userId: "bob", role: "employee" as const },
      { userId: "alice", role: "employee" as const },
      adminUser,
    ]) {
      expect(await decideLeave(approver, id, true)).toMatchObject({
        ok: false,
        status: 404,
      });
    }
    expect(await balanceOf("alice")).toBe(7);
  });

  it("decides a request only once, even when two decisions race", async () => {
    await requestLeave("alice", 3, "r1");
    const id = await pendingId("alice");

    const results = await Promise.all([
      decideLeave(managerUser, id, true),
      decideLeave(managerUser, id, false),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);

    // A refund happens only if the rejection won
    const saved = await prisma.leaveApplication.findUniqueOrThrow({
      where: { id },
    });
    expect(await balanceOf("alice")).toBe(saved.status === "rejected" ? 10 : 7);

    expect(await decideLeave(managerUser, id, true)).toMatchObject({
      ok: false,
      status: 409,
    });
  });

  it("sends requests from employees without a manager to admins", async () => {
    await prisma.employee.update({
      where: { id: "bob" },
      data: { managerId: null },
    });
    await requestLeave("bob", 2, "r1");
    const id = await pendingId("bob");

    expect(await decideLeave(managerUser, id, true)).toMatchObject({
      status: 404,
    });
    expect(await decideLeave(adminUser, id, true)).toMatchObject({ ok: true });
  });

  it("never lets an admin approve their own leave", async () => {
    await requestLeave("admin", 1, "r1");

    expect(
      await decideLeave(adminUser, await pendingId("admin"), true),
    ).toMatchObject({ ok: false, status: 404 });
  });

  it("lists only the approver's own team's pending requests", async () => {
    await requestLeave("alice", 1, "a");
    await requestLeave("bob", 2, "b");
    await requestLeave("manager", 1, "m");

    const managerQueue = await listPendingForApprover(managerUser);
    expect(managerQueue.map((request) => request.employee.id).sort()).toEqual([
      "alice",
      "bob",
    ]);

    const adminQueue = await listPendingForApprover(adminUser);
    expect(adminQueue.map((request) => request.employee.id)).toEqual([
      "manager",
    ]);

    expect(await isApprover(managerUser)).toBe(true);
    expect(await isApprover({ userId: "alice", role: "employee" })).toBe(
      false,
    );
  });

  it("lets the employee cancel a pending request, once", async () => {
    await requestLeave("alice", 4, "r1");
    const id = await pendingId("alice");

    expect(await cancelLeave("bob", id)).toMatchObject({ status: 404 });
    expect(await cancelLeave("alice", id)).toEqual({
      ok: true,
      status: "cancelled",
    });
    expect(await balanceOf("alice")).toBe(10);
    expect(await cancelLeave("alice", id)).toMatchObject({ status: 409 });
  });

  it("can't cancel a request the manager already approved", async () => {
    await requestLeave("alice", 4, "r1");
    const id = await pendingId("alice");
    await decideLeave(managerUser, id, true);

    expect(await cancelLeave("alice", id)).toMatchObject({ status: 409 });
    expect(await balanceOf("alice")).toBe(6);
  });
});
