import { AIMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";

import {
  streamErrorMessage,
  toAgentStreamEvents,
  type AgentStreamEvent,
} from "@/lib/agent-stream-events";
import type { RagSource } from "@/lib/langchain-rag";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import {
  createSupervisorAgent,
  deleteSupervisorRun,
  getSupervisorCheckpointer,
  supervisorConfig,
} from "@/lib/supervisor-agent";

// Resuming finishes the turn with more model calls, longer than a
// serverless default allows
export const maxDuration = 300;

const NO_LONGER_AVAILABLE =
  "This approval request is no longer available. Please start a new request.";

// Continues a /api/chat run that paused for approval, with the person's
// decision: approved → hrGraph runs applyLeave, rejected → it replies
// without touching the database. Streams the same NDJSON events as
// /api/chat and saves the outcome to the run's conversation.
// The body is only { threadId, approved }: who may resume it and which
// conversation it belongs to both come from its AgentThread record.
export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const threadId: unknown = body?.threadId;
  const approved: unknown = body?.approved;

  if (typeof threadId !== "string" || !threadId.trim()) {
    return Response.json({ error: "Thread ID is required" }, { status: 400 });
  }

  // A boolean only: a missing or truthy value like "no" must not approve
  if (typeof approved !== "boolean") {
    return Response.json(
      { error: "approved must be true or false" },
      { status: 400 },
    );
  }

  // Matched on id and owner, so another user's thread gets the same 404 as
  // one that doesn't exist. Only /api/chat threads have a conversation;
  // /api/langgraph-test ones are resumed by their own route.
  const thread = await prisma.agentThread.findFirst({
    where: { id: threadId, userId: user.userId, conversationId: { not: null } },
    select: { id: true, conversationId: true },
  });

  if (!thread?.conversationId) {
    return Response.json({ error: "Thread not found" }, { status: 404 });
  }

  const { conversationId } = thread;
  const config = supervisorConfig(threadId);
  const supervisorCheckpointer = await getSupervisorCheckpointer();
  const agent = createSupervisorAgent(user.userId, {
    checkpointer: supervisorCheckpointer,
  });

  // Only resume a run that is actually paused. Its saved state can be gone
  // (it already finished, or was saved before checkpoints moved to the
  // database), and resuming an empty thread would start a new run instead.
  const snapshot = await agent.graph.getState(config);
  const isPaused = snapshot.tasks.some((task) => task.interrupts?.length);

  if (!isPaused) {
    // Nothing left to resume, so the ownership record is stale
    await prisma.agentThread.deleteMany({ where: { id: threadId } });

    return Response.json({ error: NO_LONGER_AVAILABLE }, { status: 409 });
  }

  // Claim the run: deleting the record is atomic, so if Approve is clicked
  // twice only one request gets count 1 and resumes. Put back below if the
  // resume fails, so the person can try again (applyLeave's requestId makes
  // a retry safe).
  const claimed = await prisma.agentThread.deleteMany({
    where: { id: threadId, userId: user.userId },
  });

  if (claimed.count === 0) {
    return Response.json({ error: NO_LONGER_AVAILABLE }, { status: 409 });
  }

  const restoreThread = () =>
    prisma.agentThread
      .create({ data: { id: threadId, userId: user.userId, conversationId } })
      .catch((error) => console.error("Could not restore thread", error));

  // interrupt() in hrGraph's approval node returns this value. An object,
  // because LangGraph ignores a falsy resume like false.
  let stream;

  try {
    stream = await agent.stream(new Command({ resume: { approved } }), {
      ...config,
      streamMode: ["updates", "messages"],
    });
  } catch (error) {
    console.error(error);
    await restoreThread();

    return Response.json({ error: streamErrorMessage(error) }, { status: 500 });
  }

  const encoder = new TextEncoder();

  const readableStream = new ReadableStream({
    async start(controller) {
      const send = (event: AgentStreamEvent) =>
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));

      let answer = "";
      const sources = new Map<string, RagSource>();
      // The specialist's own reply, used if the supervisor writes nothing
      let lastToolResult = "";
      // Set if the resumed run pauses for another approval
      let approval: Extract<AgentStreamEvent, { type: "approval" }> | undefined;
      let finished = false;

      try {
        for await (const part of stream) {
          for (const event of toAgentStreamEvents(part)) {
            if (event.type === "text") {
              answer += event.content;
            }

            if (event.type === "sources") {
              for (const source of event.sources) {
                sources.set(source.id, source);
              }
            }

            if (event.type === "tool_result" && typeof event.result === "string") {
              lastToolResult = event.result;
            }

            if (event.type === "approval") {
              approval = event;
              continue;
            }

            send(event);
          }
        }

        if (approval) {
          // Paused again: keep it resumable under the same thread
          await restoreThread();
          send({ ...approval, threadId });
        } else {
          // Gemini sometimes ends a resumed run without streaming its reply:
          // take the final message from the saved state, or failing that
          // the specialist's reply
          if (!answer) {
            const state = await agent.graph.getState(config);
            const last = state.values.messages?.at(-1);

            answer =
              (AIMessage.isInstance(last) && last.text) ||
              lastToolResult ||
              (approved
                ? "Your leave application was processed."
                : "Your leave request was not approved.");

            send({ type: "text", content: answer });
          }

          // The outcome joins the conversation after the "waiting for your
          // approval" message /api/chat saved when the run paused
          await prisma.message.create({
            data: {
              conversationId,
              role: "ai",
              text: answer,
              sources: [...sources.values()],
            },
          });
        }

        finished = true;
      } catch (error) {
        console.error(error);
        send({ type: "error", message: streamErrorMessage(error) });
      }

      if (!finished) {
        // Failed part-way: let the person try again
        await restoreThread();
      } else if (!approval) {
        // Done: nothing will read this run's saved state again
        await deleteSupervisorRun(supervisorCheckpointer, threadId).catch((error) => {
          console.error("Could not delete finished thread", error);
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
