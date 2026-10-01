import { HumanMessage } from "@langchain/core/messages";
import { NextResponse } from "next/server";

import { hrGraph } from "@/lib/hr-graph";
import {
  graphConfig,
  graphErrorResponse,
  graphResponse,
} from "@/lib/hr-graph-run";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

// Starts a run of the hand-built LangGraph agent. It either answers, or
// pauses before applyLeave and returns status "pending_approval" with a
// threadId to send to /api/langgraph-test/resume.
export async function POST(req: Request) {
  // Who the caller is comes only from the signed session cookie. A userId in
  // the body is ignored, so a caller can't act as another employee.
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Chosen by the client or the app, never by the agent: the tool node builds
  // applyLeave with it, so a retry with the same Idempotency-Key can't deduct
  // the leave twice. `||` so an empty header falls back too.
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

    // A new thread per request keeps runs separate: reusing an ID would
    // append this question to that thread's earlier messages
    const threadId = crypto.randomUUID();

    // Record who owns the thread before the run starts, so /resume can check
    // it. Only created here, never in /resume: a caller must not be able to
    // claim a thread that already exists.
    await prisma.agentThread.create({
      data: { id: threadId, userId: user.userId },
    });

    // A real message object: GraphState's own reducer just appends, so it
    // doesn't convert { role, content } objects like MessagesAnnotation would
    const result = await hrGraph.invoke(
      {
        messages: [new HumanMessage(question)],
        requestId,
        userId: user.userId,
      },
      graphConfig(threadId),
    );

    return graphResponse(result, threadId);
  } catch (error) {
    return graphErrorResponse(error);
  }
}
