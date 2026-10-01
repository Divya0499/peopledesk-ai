import { NextResponse } from "next/server";
import { createLeaveAgent } from "@/lib/langchain-agent";
import { getCurrentUser } from "@/lib/session";

// The agent runs the whole tool loop; the response includes every message
// (question, tool call, tool result, final answer) so the steps are visible.
export async function POST(req: Request) {
  // Who the caller is comes only from the signed session cookie. A userId in
  // the body is ignored, so a caller can't act as another employee.
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Chosen by the client or the app, never by the agent. A retry resends the
  // same Idempotency-Key so applyLeave doesn't deduct the days twice. `||`
  // rather than `??` so an empty header falls back instead of becoming a
  // shared "" key.
  const requestId = req.headers.get("Idempotency-Key") || crypto.randomUUID();

  try {
    const body = await req.json();
    const question = body.question;

    if (typeof question !== "string" || !question.trim()) {
      return NextResponse.json(
        { error: "Question is required" },
        { status: 400 },
      );
    }

    const agent = createLeaveAgent(user.userId, requestId);

    const result = await agent.invoke({
      messages: [
        {
          role: "user",
          content: question,
        },
      ],
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 },
    );
  }
}
