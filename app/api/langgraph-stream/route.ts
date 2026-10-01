import { HumanMessage } from "@langchain/core/messages";
import { GraphRecursionError } from "@langchain/langgraph";
import { NextResponse } from "next/server";

import {
  toAgentStreamEvents,
  type AgentStreamEvent,
} from "@/lib/agent-stream-events";
import { hrGraph } from "@/lib/hr-graph";
import { graphConfig } from "@/lib/hr-graph-run";
import { getCurrentUser } from "@/lib/session";

// Runs the LangGraph agent and streams what it's doing to the browser as
// NDJSON: one AgentStreamEvent (tool_start, tool_result, text, error) as JSON
// per line. A pause for applyLeave approval isn't sent yet, so an approval
// run just ends without text.
export async function POST(req: Request) {
  // Who the caller is comes only from the signed session cookie. A userId in
  // the body is ignored, so a caller can't act as another employee.
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const message = body.message;

  if (typeof message !== "string" || !message.trim()) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  // A real message object: GraphState's own reducer just appends, so it
  // doesn't convert { role, content } objects like MessagesAnnotation would
  const stream = await hrGraph.stream(
    {
      messages: [new HumanMessage(message)],
      userId: user.userId,
      requestId: crypto.randomUUID(),
    },
    {
      // A new thread per request keeps runs separate
      ...graphConfig(crypto.randomUUID()),
      // "updates" for tool calls and results, "messages" for the agent's
      // text as it's generated; toAgentStreamEvents turns both into events
      streamMode: ["updates", "messages"],
    },
  );

  // A Response body carries bytes, not strings
  const encoder = new TextEncoder();

  const readableStream = new ReadableStream({
    async start(controller) {
      // The newline ends each event, so the browser can split them apart
      // however the bytes get chunked on the way
      const send = (event: AgentStreamEvent) =>
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));

      try {
        for await (const part of stream) {
          for (const event of toAgentStreamEvents(part)) {
            send(event);
          }
        }
      } catch (error) {
        // Headers (and a 200) are already sent, so the failure has to travel
        // as an event in the stream rather than as a status code
        console.error(error);
        send({
          type: "error",
          message:
            error instanceof GraphRecursionError
              ? "The assistant took too many steps to answer"
              : "Internal server error",
        });
      }

      controller.close();
    },
  });

  return new Response(readableStream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
