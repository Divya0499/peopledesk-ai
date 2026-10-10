import { z } from "zod";

import { MAX_REASON_LENGTH, requestLeave } from "@/lib/leave";
import { getLeaveOverview } from "@/lib/leave-overview";
import { getCurrentUser } from "@/lib/session";

const MAX_DAYS_PER_REQUEST = 60;

const requestSchema = z.object({
  days: z.number().int().min(1).max(MAX_DAYS_PER_REQUEST),
  reason: z.string().max(MAX_REASON_LENGTH).optional(),
});

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

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return Response.json(await getLeaveOverview(user));
  } catch (error) {
    console.error(error);

    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
