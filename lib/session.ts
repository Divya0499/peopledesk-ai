import "server-only";

import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";

import type { UserRole } from "./generated/prisma/client";
import { prisma } from "./prisma";

// The single source of truth for "who is calling". Routes and tools get the
// user from getCurrentUser(), never from the request body, a query parameter
// or a tool argument.

const SESSION_COOKIE = "session";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export type CurrentUser = {
  userId: string;
  role: UserRole;
};

// The cookie only carries the user ID. The role is looked up on each request,
// so it can't be stale or forged into the token.
type SessionPayload = {
  userId: string;
};

// Read lazily so a missing secret fails the request that needs it rather
// than the build. A short secret makes HS256 signatures guessable.
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

// Returns null for a missing, tampered or expired token. Pinning the
// algorithm stops a token signed with a different alg from being accepted.
async function verifySession(token: string | undefined) {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ["HS256"],
    });

    return typeof payload.userId === "string" && payload.userId
      ? { userId: payload.userId }
      : null;
  } catch {
    return null;
  }
}

// Call only after the caller's identity has been proven (the login step).
export async function createSession(userId: string) {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  const token = await signSession({ userId }, expiresAt);
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, token, {
    // Not readable from client JavaScript, so an XSS can't steal it
    httpOnly: true,
    // Plain http on localhost in development
    secure: process.env.NODE_ENV === "production",
    // Not sent on cross-site POSTs, which blocks basic CSRF on the API
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

// The verified caller, or null if there is no valid session. Also null when
// the employee no longer exists, so a deleted user's cookie stops working.
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const session = await verifySession(cookieStore.get(SESSION_COOKIE)?.value);

  if (!session) return null;

  const employee = await prisma.employee.findUnique({
    where: { id: session.userId },
    select: { id: true, role: true },
  });

  if (!employee) return null;

  return { userId: employee.id, role: employee.role };
}
