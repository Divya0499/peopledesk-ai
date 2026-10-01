import { Command } from "@langchain/langgraph";
import { NextResponse } from "next/server";

import { hrGraph } from "@/lib/hr-graph";
import {
  graphConfig,
  graphErrorResponse,
  graphResponse,
} from "@/lib/hr-graph-run";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

// Resumes a run paused at the approval node with the person's decision:
// approved → applyLeave runs, rejected → a rejection reply, without touching
// the database.
export async function POST(req: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { threadId, approved } = await req.json();

    if (typeof threadId !== "string" || !threadId.trim()) {
      return NextResponse.json(
        { error: "Thread ID is required" },
        { status: 400 },
      );
    }

    // A boolean only: a missing or truthy value like "no" must not approve
    if (typeof approved !== "boolean") {
      return NextResponse.json(
        { error: "approved must be true or false" },
        { status: 400 },
      );
    }

    // A threadId alone proves nothing: only the user who started the run may
    // approve or reject it. Ownership was recorded when the run started.
    // Matched on both id and owner, so another user's thread gets the same 404
    // as one that doesn't exist and its existence isn't revealed.
    const thread = await prisma.agentThread.findFirst({
      where: { id: threadId, userId: user.userId },
      select: { id: true },
    });

    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    const config = graphConfig(threadId);

    // Only resume a run that is actually waiting for approval: an unknown
    // or finished thread would otherwise start an empty run
    const snapshot = await hrGraph.getState(config);

    if (!snapshot.next.includes("approval")) {
      return NextResponse.json(
        { error: "No leave application is waiting for approval" },
        { status: 409 },
      );
    }

    // interrupt() in the approval node returns this value. Wrapped in an
    // object because LangGraph ignores a falsy resume like false.
    const result = await hrGraph.invoke(
      new Command({ resume: { approved } }),
      config,
    );

    return graphResponse(result, threadId);
  } catch (error) {
    return graphErrorResponse(error);
  }
}
