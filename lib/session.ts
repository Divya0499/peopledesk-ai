import "server-only";

import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";

import type { UserRole } from "./generated/prisma/client";
import { prisma } from "./prisma";
import { isAdminRole } from "./roles";

const SESSION_COOKIE = "session";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export type CurrentUser = {
  userId: string;
  name: string;
  email: string;
  role: UserRole;
};

// only the id in the token, role is read from the db every time.
// version has to match Employee.tokenVersion, so bumping that (e.g. on a
// password change) logs out every existing session
type SessionPayload = {
  userId: string;
  version: number;
};

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set to at least 32 characters");
  }

  return new TextEncoder().encode(secret);
}

async function signSession(payload: SessionPayload, expiresAt: Date) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(getSecretKey());
}

async function verifySession(token: string | undefined) {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ["HS256"],
    });

    if (typeof payload.userId !== "string" || !payload.userId) {
      return null;
    }

    // tokens from before tokenVersion existed count as version 0
    const version = typeof payload.version === "number" ? payload.version : 0;

    return { userId: payload.userId, version };
  } catch {
    return null;
  }
}

export async function createSession(userId: string) {
  const { tokenVersion } = await prisma.employee.findUniqueOrThrow({
    where: { id: userId },
    select: { tokenVersion: true },
  });
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  const token = await signSession({ userId, version: tokenVersion }, expiresAt);
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const session = await verifySession(cookieStore.get(SESSION_COOKIE)?.value);

  if (!session) return null;

  // also handles deleted users
  const employee = await prisma.employee.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true, role: true, tokenVersion: true },
  });

  // version mismatch = the token was revoked (e.g. password changed)
  if (!employee || employee.tokenVersion !== session.version) return null;

  return {
    userId: employee.id,
    name: employee.name,
    email: employee.email,
    role: employee.role,
  };
}

export async function requireAdmin(): Promise<
  { user: CurrentUser; error?: never } | { user?: never; error: Response }
> {
  const user = await getCurrentUser();

  if (!user) {
    return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  if (!isAdminRole(user.role)) {
    return { error: Response.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { user };
}
