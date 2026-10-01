import { Command } from "@langchain/langgraph";
import { NextResponse } from "next/server";

import { hrGraph } from "@/lib/hr-graph";
import {
  graphConfig,
  graphErrorResponse,
  graphResponse,
} from "@/lib/hr-graph-run";

// Resumes a run paused at the approval node with the person's decision:
// approved → applyLeave runs, rejected → a rejection reply, without touching
// the database.
export async function POST(req: Request) {
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
