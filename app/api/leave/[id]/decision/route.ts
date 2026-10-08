import { z } from "zod";

import { decideLeave, MAX_NOTE_LENGTH } from "@/lib/leave";
import { getCurrentUser } from "@/lib/session";

const bodySchema = z.object({
  approve: z.boolean(),
  note: z.string().max(MAX_NOTE_LENGTH).optional(),
});

// A manager approves or rejects one of their team's pending requests.
// decideLeave() checks the caller may decide it, so the request id in the
// URL grants nothing on its own.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = bodySchema.safeParse(await request.json().catch(() => null));

  if (!body.success) {
    return Response.json(
      { error: "Send approve (true or false) and an optional note" },
      { status: 400 },
    );
  }

  try {
    const { id } = await params;
    const result = await decideLeave(
      user,
      id,
      body.data.approve,
      body.data.note,
    );

    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    return Response.json({ status: result.status });
  } catch (error) {
    console.error(error);

    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
