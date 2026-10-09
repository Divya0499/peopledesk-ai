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

export const maxDuration = 300;

const NO_LONGER_AVAILABLE =
  "This approval request is no longer available. Please start a new request.";

// continues a paused /api/chat run after the user clicks confirm / cancel
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

  if (typeof approved !== "boolean") {
    return Response.json(
      { error: "approved must be true or false" },
      { status: 400 },
    );
  }

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

  // resuming a thread with no saved state would start a new run
  const snapshot = await agent.graph.getState(config);
  const isPaused = snapshot.tasks.some((task) => task.interrupts?.length);

  if (!isPaused) {
    await prisma.agentThread.deleteMany({ where: { id: threadId } });

    return Response.json({ error: NO_LONGER_AVAILABLE }, { status: 409 });
  }

  // delete = claim it, so a double click only resumes once.
  // put back with restoreThread() if something fails
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

  let stream;

  try {
    // has to be an object, langgraph ignores resume: false
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
      let lastToolResult = "";
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
          await restoreThread();
          send({ ...approval, threadId });
        } else {
          // same gemini issue as in /api/chat, sometimes there's no streamed reply
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
        await restoreThread();
      } else if (!approval) {
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
