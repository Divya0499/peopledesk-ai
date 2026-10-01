import { NextResponse } from "next/server";
import { createLeaveAgent } from "@/lib/langchain-agent";

// The agent runs the whole tool loop; the response includes every message
// (question, tool call, tool result, final answer) so the steps are visible.
export async function POST(req: Request) {
  // Chosen by the client or the app, never by the agent. A retry resends the
  // same Idempotency-Key so applyLeave doesn't deduct the days twice. `||`
  // rather than `??` so an empty header falls back instead of becoming a
  // shared "" key.
  const requestId = req.headers.get("Idempotency-Key") || crypto.randomUUID();

  try {
    const { question } = await req.json();

    if (typeof question !== "string" || !question.trim()) {
      return NextResponse.json(
        { error: "Question is required" },
        { status: 400 },
      );
    }

    const agent = createLeaveAgent(requestId);

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
        error: error instanceof Error ? error.message : "Something went wrong",
      },
      { status: 500 },
    );
  }
}
