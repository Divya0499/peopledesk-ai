import { NextResponse } from "next/server";

import { hashPassword, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit, resetRateLimit } from "@/lib/rate-limit";
import { createSession } from "@/lib/session";

const MAX_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

// so unknown emails take the same time as wrong passwords
const dummyHash = hashPassword("not-a-real-password");

const INVALID = "Invalid email or password";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email =
    typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 },
    );
  }

  const limitKey = `login:${email}:${clientIp(req)}`;
  const limit = rateLimit(limitKey, MAX_ATTEMPTS, ATTEMPT_WINDOW_MS);

  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: `Too many login attempts. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} minutes.`,
      },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      },
    );
  }

  const employee = await prisma.employee.findUnique({
    where: { email },
    select: { id: true, name: true, role: true, passwordHash: true },
  });

  const passwordOk = await verifyPassword(
    password,
    employee?.passwordHash ?? (await dummyHash),
  );

  // same error either way
  if (!employee?.passwordHash || !passwordOk) {
    return NextResponse.json({ error: INVALID }, { status: 401 });
  }

  resetRateLimit(limitKey);
  await createSession(employee.id);

  return NextResponse.json({
    user: { userId: employee.id, name: employee.name, role: employee.role },
  });
}
