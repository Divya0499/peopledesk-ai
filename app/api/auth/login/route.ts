import { NextResponse } from "next/server";

import { hashPassword, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit, resetRateLimit } from "@/lib/rate-limit";
import { createSession } from "@/lib/session";

const MAX_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

// Compared against when the email doesn't exist, so a missing account takes
// as long to reject as a wrong password and response times don't reveal
// which emails are registered
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

  // Per account and address: slows down guessing one account's password
  // without letting one address lock everyone else out
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

  // The same message for an unknown email, an account without a password
  // and a wrong password, so the response can't be used to find accounts
  if (!employee?.passwordHash || !passwordOk) {
    return NextResponse.json({ error: INVALID }, { status: 401 });
  }

  resetRateLimit(limitKey);
  await createSession(employee.id);

  return NextResponse.json({
    user: { userId: employee.id, name: employee.name, role: employee.role },
  });
}
