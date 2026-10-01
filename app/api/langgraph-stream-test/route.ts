import { HumanMessage } from "@langchain/core/messages";
import { NextResponse } from "next/server";

import { toAgentStreamEvents } from "@/lib/agent-stream-events";
import { hrGraph } from "@/lib/hr-graph";
import { graphConfig } from "@/lib/hr-graph-run";
import { getCurrentUser } from "@/lib/session";

// Temporary: runs the LangGraph agent with stream() and turns the raw
// LangGraph events into the frontend's events (tool_start, tool_result,
// text). Each event is logged to the server terminal and returned as JSON.
export async function GET() {
  // Who the caller is comes only from the signed session cookie
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();

  // A real message object: GraphState's own reducer just appends, so it
  // doesn't convert { role, content } objects like MessagesAnnotation would
  const stream = await hrGraph.stream(
    {
      messages: [new HumanMessage("What is my leave balance?")],
      userId: user.userId,
      requestId: crypto.randomUUID(),
    },
    {
      // A new thread per run, so repeat runs don't append to earlier messages
      ...graphConfig(crypto.randomUUID()),
      // Both modes from one run: "updates" says what each node did (tool
      // calls, tool results), "messages" streams the LLM's text as it's
      // generated. Each event then arrives as [mode, data].
      streamMode: ["updates", "messages"],
    },
  );

  const events = [];

  for await (const part of stream) {
    for (const event of toAgentStreamEvents(part)) {
      console.log(event);
      events.push({ ms: Date.now() - startedAt, ...event });
    }
  }

  return NextResponse.json({ events });
}
