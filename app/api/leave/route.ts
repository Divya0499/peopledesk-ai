import { z } from "zod";

import {
  isApprover,
  listMyLeaveRequests,
  listPendingForApprover,
  MAX_REASON_LENGTH,
  requestLeave,
} from "@/lib/leave";
import { getCurrentUser } from "@/lib/session";
import { getLeaveBalance } from "@/lib/tools";

const MAX_DAYS_PER_REQUEST = 60;

const requestSchema = z.object({
  days: z.number().int().min(1).max(MAX_DAYS_PER_REQUEST),
  reason: z.string().max(MAX_REASON_LENGTH).optional(),
});

// The leave form: the same requestLeave() the chat assistant uses. The
// client sends a fresh Idempotency-Key per request, so a retried or
// double-clicked submit reserves the days only once.
export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requestId = request.headers.get("idempotency-key")?.trim();

  if (!requestId || requestId.length > 100) {
    return Response.json(
      { error: "An Idempotency-Key header is required" },
      { status: 400 },
    );
  }

  const body = requestSchema.safeParse(await request.json().catch(() => null));

  if (!body.success) {
    return Response.json(
      {
        error: `Days must be a whole number from 1 to ${MAX_DAYS_PER_REQUEST}`,
      },
      { status: 400 },
    );
  }

  try {
    const result = await requestLeave(
      user.userId,
      body.data.days,
      // Scoped to the user, so one person's key can never match another's
      `form:${user.userId}:${requestId}`,
      body.data.reason,
    );

    if (!result.success) {
      return Response.json({ error: result.error }, { status: 409 });
    }

    return Response.json(
      { status: "pending", message: result.message },
      { status: 201 },
    );
  } catch (error) {
    console.error(error);

    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Everything the leave page shows: the caller's balance and requests, and,
// if they approve anyone's leave, the requests waiting for their decision
export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [balance, mine, approver] = await Promise.all([
      getLeaveBalance(user.userId),
      listMyLeaveRequests(user.userId),
      isApprover(user),
    ]);

    return Response.json({
      leaveBalance: "leaveBalance" in balance ? balance.leaveBalance : 0,
      pendingDays: "pendingDays" in balance ? balance.pendingDays : 0,
      mine,
      isApprover: approver,
      // null rather than [] when they approve no one, so the page can tell
      // "no team" from "nothing waiting"
      teamPending: approver ? await listPendingForApprover(user) : null,
    });
  } catch (error) {
    console.error(error);

    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
