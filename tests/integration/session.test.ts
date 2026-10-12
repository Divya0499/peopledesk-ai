import { SignJWT } from "jose";
import { beforeEach, expect, it, vi } from "vitest";

import { updateEmployee } from "@/lib/employees";
import { prisma } from "@/lib/prisma";

import { describeDb, resetDatabase, seedTeam } from "../support/db";

// a plain map instead of the browser's cookie jar; everything else is real
const jar = vi.hoisted(() => new Map<string, string>());

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      jar.has(name) ? { name, value: jar.get(name)! } : undefined,
    set: (name: string, value: string) => jar.set(name, value),
    delete: (name: string) => jar.delete(name),
  }),
}));

const { createSession, getCurrentUser } = await import("@/lib/session");

const adminUser = { userId: "admin", role: "admin" as const };

describeDb("sessions", () => {
  beforeEach(async () => {
    jar.clear();
    await resetDatabase();
    await seedTeam();
  });

  it("logs in with a fresh session", async () => {
    await createSession("alice");

    expect(await getCurrentUser()).toMatchObject({ userId: "alice" });
  });

  it("logs out existing sessions when the password changes", async () => {
    await createSession("alice");
    const oldToken = jar.get("session")!;

    await updateEmployee(adminUser, "alice", { password: "New@123456" });

    // the old token is still validly signed and not expired, but revoked
    jar.set("session", oldToken);
    expect(await getCurrentUser()).toBeNull();

    // logging in again works
    await createSession("alice");
    expect(await getCurrentUser()).toMatchObject({ userId: "alice" });
  });

  it("keeps sessions when something other than the password changes", async () => {
    await createSession("alice");

    await updateEmployee(adminUser, "alice", { department: "Sales" });

    expect(await getCurrentUser()).toMatchObject({ userId: "alice" });
  });

  it("still accepts tokens from before versions existed", async () => {
    // what login used to issue: only the user id
    const legacy = await new SignJWT({ userId: "alice" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode(process.env.SESSION_SECRET));
    jar.set("session", legacy);

    expect(await getCurrentUser()).toMatchObject({ userId: "alice" });

    await prisma.employee.update({
      where: { id: "alice" },
      data: { tokenVersion: { increment: 1 } },
    });
    expect(await getCurrentUser()).toBeNull();
  });
});
