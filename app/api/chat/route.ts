import { AIMessage } from "@langchain/core/messages";

import {
  streamErrorMessage,
  toAgentStreamEvents,
  type AgentStreamEvent,
} from "@/lib/agent-stream-events";
import type { RagSource } from "@/lib/langchain-rag";
import { toLangChainMessages } from "@/lib/langchain-history";
import { leaveConfirmText } from "@/lib/leave-text";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/session";
import { UsageTracker } from "@/lib/usage-tracker";
import {
  createSupervisorAgent,
  deleteSupervisorRun,
  getSupervisorCheckpointer,
  supervisorConfig,
} from "@/lib/supervisor-agent";

// one turn can take 10-45s because of all the model calls
export const maxDuration = 300;

const HISTORY_LIMIT = 20;

const APPROVAL_ALREADY_PENDING =
  "You already have a leave request waiting for your confirmation. Please confirm or cancel it before starting a new one.";

function pendingApprovalText(
  event: Extract<AgentStreamEvent, { type: "approval" }>,
) {
  const days = event.toolCall.args.days;

  if (event.toolCall.name === "applyLeave" && typeof days === "number") {
    return leaveConfirmText(days);
  }

  return event.message;
}

const CHAT_REQUESTS_PER_MINUTE = 20;

// streams back NDJSON, one AgentStreamEvent per line
export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = rateLimit(
    `chat:${user.userId}`,
    CHAT_REQUESTS_PER_MINUTE,
    60_000,
  );

  if (!limit.allowed) {
    return Response.json(
      {
        error: `You're sending messages too quickly. Please wait ${limit.retryAfterSeconds} seconds.`,
      },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      },
    );
  }

  const body = await request.json().catch(() => null);
  const conversationId: unknown = body?.conversationId;
  const question =
    typeof body?.question === "string" ? body.question.trim() : "";

  if (typeof conversationId !== "string" || !conversationId.trim()) {
    return Response.json(
      { error: "Conversation is required" },
      { status: 400 },
    );
  }

  // filter by owner too, so someone else's conversation just looks like a 404
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, userId: user.userId },
    select: { id: true },
  });

  if (!conversation) {
    return Response.json(
      { error: "Conversation not found" },
      { status: 404 },
    );
  }

  if (!question) {
    return Response.json({ error: "Question is required" }, { status: 400 });
  }

  // history from the db, not the client. load it before saving the new question
  const history = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: HISTORY_LIMIT,
    select: { role: true, text: true },
  });

  history.reverse();

  const askedAt = new Date();

  // new thread per request (not conversationId) - otherwise the checkpointer
  // keeps a second copy of every message
  const threadId = crypto.randomUUID();
  const config = supervisorConfig(threadId);

  const supervisorCheckpointer = await getSupervisorCheckpointer();
  const agent = createSupervisorAgent(user.userId, {
    checkpointer: supervisorCheckpointer,
  });

  const usage = new UsageTracker();
  const startedAt = Date.now();

  const stream = await agent.stream(
    {
      messages: toLangChainMessages([
        ...history,
        { role: "user", text: question },
      ]),
    },
    {
      ...config,
      callbacks: [usage],
      streamMode: ["updates", "messages"],
    },
  );

  const encoder = new TextEncoder();

  const readableStream = new ReadableStream({
    async start(controller) {
      const send = (event: AgentStreamEvent) =>
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));

      let answer = "";
      const sources = new Map<string, RagSource>();
      let approval: Extract<AgentStreamEvent, { type: "approval" }> | undefined;
      let resumable = false;

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

            // sent later, once the AgentThread row exists
            if (event.type === "approval") {
              approval = event;
              continue;
            }

            send(event);
          }
        }

        if (approval) {
          // only one pending approval per user
          resumable = await prisma.$transaction(async (tx) => {
            // lock so two parallel requests can't both pass the check
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${user.userId}))`;

            const others = await tx.agentThread.findMany({
              where: { userId: user.userId, conversationId: { not: null } },
              select: { id: true },
            });

            for (const other of others) {
              const state = await agent.graph.getState(supervisorConfig(other.id));

              if (state.tasks.some((task) => task.interrupts?.length)) {
                return false;
              }

              // stale, the run isn't paused anymore
              await tx.agentThread.delete({ where: { id: other.id } });
            }

            await tx.agentThread.create({
              data: { id: threadId, userId: user.userId, conversationId },
            });

            return true;
          });
        }

        if (approval && !resumable) {
          approval = undefined;
          answer = APPROVAL_ALREADY_PENDING;
          send({ type: "text", content: answer });
        }

        if (approval) {
          await prisma.$transaction([
            prisma.message.create({
              data: {
                conversationId,
                role: "user",
                text: question,
                createdAt: askedAt,
              },
            }),
            prisma.message.create({
              data: {
                conversationId,
                role: "ai",
                text: pendingApprovalText(approval),
              },
            }),
          ]);

          send({ ...approval, threadId });
        } else {
          // gemini sometimes doesn't stream the final reply, take it from the state
          if (!answer) {
            const state = await agent.graph.getState(config);
            const last = state.values.messages?.at(-1);

            if (AIMessage.isInstance(last) && last.text) {
              answer = last.text;
              send({ type: "text", content: answer });
            }
          }

          if (answer) {
            await prisma.$transaction([
              prisma.message.create({
                data: {
                  conversationId,
                  role: "user",
                  text: question,
                  createdAt: askedAt,
                },
              }),
              prisma.message.create({
                data: {
                  conversationId,
                  role: "ai",
                  text: answer,
                  sources: [...sources.values()],
                },
              }),
            ]);
          }
        }
      } catch (error) {
        // already sent 200, so the error goes in the stream
        console.error(error);
        send({ type: "error", message: streamErrorMessage(error) });
      }

      if (!resumable) {
        await deleteSupervisorRun(supervisorCheckpointer, threadId).catch((error) => {
          console.error("Could not delete finished thread", error);
        });
      }

      const summary = usage.getSummary();
      console.log(
        JSON.stringify({
          event: "chat_request",
          userId: user.userId,
          durationMs: Date.now() - startedAt,
          llmCalls: summary.llmCalls,
          toolCalls: summary.toolCalls,
          inputTokens: summary.inputTokens,
          outputTokens: summary.outputTokens,
          errors: summary.errors,
          pausedForApproval: Boolean(approval),
        }),
      );

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
