import { HumanMessage } from "@langchain/core/messages";
import { NextResponse } from "next/server";

import { hrGraph } from "@/lib/hr-graph";
import {
  graphConfig,
  graphErrorResponse,
  graphResponse,
} from "@/lib/hr-graph-run";

// Starts a run of the hand-built LangGraph agent. It either answers, or
// pauses before applyLeave and returns status "pending_approval" with a
// threadId to send to /api/langgraph-test/resume.
export async function POST(req: Request) {
  // Chosen by the client or the app, never by the agent: the tool node builds
  // applyLeave with it, so a retry with the same Idempotency-Key can't deduct
  // the leave twice. `||` so an empty header falls back too.
  const requestId = req.headers.get("Idempotency-Key") || crypto.randomUUID();

  try {
    const body = await req.json();
    const question = body.question;
    // No auth yet: like /api/tools-test, default to the demo employee.
    // Once there are logins this must come from the session, not the body.
    const userId =
      typeof body.userId === "string" && body.userId ? body.userId : "user-123";

    if (typeof question !== "string" || !question.trim()) {
      return NextResponse.json(
        { error: "Question is required" },
        { status: 400 },
      );
    }

    // A new thread per request keeps runs separate: reusing an ID would
    // append this question to that thread's earlier messages
    const threadId = crypto.randomUUID();

    // A real message object: GraphState's own reducer just appends, so it
    // doesn't convert { role, content } objects like MessagesAnnotation would
    const result = await hrGraph.invoke(
      {
        messages: [new HumanMessage(question)],
        requestId,
        userId,
      },
      graphConfig(threadId),
    );

    return graphResponse(result, threadId);
  } catch (error) {
    return graphErrorResponse(error);
  }
}
