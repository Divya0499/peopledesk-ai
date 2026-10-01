import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/session";

// Development-only login: Employee has no passwords yet, so this trusts the
// userId it is given. It is the one place that does, and it is disabled in
// production. A real login replaces this by verifying credentials first.
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const userId = body?.userId;

  if (typeof userId !== "string" || !userId.trim()) {
    return NextResponse.json({ error: "User ID is required" }, { status: 400 });
  }

  const employee = await prisma.employee.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });

  if (!employee) {
    return NextResponse.json({ error: "Unknown user" }, { status: 401 });
  }

  await createSession(employee.id);

  return NextResponse.json({ user: { userId: employee.id, role: employee.role } });
}
