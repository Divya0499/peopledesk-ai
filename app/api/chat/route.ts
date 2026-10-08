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
import { getCurrentUser } from "@/lib/session";
import {
  createSupervisorAgent,
  deleteSupervisorRun,
  getSupervisorCheckpointer,
  supervisorConfig,
} from "@/lib/supervisor-agent";

// How many earlier messages the supervisor sees, newest kept. Bounds the
// prompt size however long the conversation gets.
const HISTORY_LIMIT = 20;

// The reply when a run pauses for approval while another approval of this
// user's is still waiting: only one at a time
const APPROVAL_ALREADY_PENDING =
  "You already have a leave request waiting for your confirmation. Please confirm or cancel it before starting a new one.";

// Saved as the assistant's turn when a run pauses for approval, so the
// conversation history shows what happened instead of an unanswered question
function pendingApprovalText(
  event: Extract<AgentStreamEvent, { type: "approval" }>,
) {
  const days = event.toolCall.args.days;

  if (event.toolCall.name === "applyLeave" && typeof days === "number") {
    return leaveConfirmText(days);
  }

  return event.message;
}

// The chat endpoint: the supervisor agent decides which specialist (company
// documents, HR, MCP HR) answers, and what it's doing streams back as NDJSON,
// one AgentStreamEvent per line (see agent-stream-events.ts).
export async function POST(request: Request) {
  // Who the caller is comes only from the signed session cookie
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const conversationId: unknown = body?.conversationId;
  // Only the new question: the history comes from the database
  const question =
    typeof body?.question === "string" ? body.question.trim() : "";

  if (typeof conversationId !== "string" || !conversationId.trim()) {
    return Response.json(
      { error: "Conversation is required" },
      { status: 400 },
    );
  }

  // Matched on both id and owner, so another user's conversationId looks
  // the same as one that doesn't exist: 404, without revealing it exists.
  // Checked before the agent runs, and before anything is saved.
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

  // The conversation so far comes from the database, never from the client,
  // so a caller can't put words in the assistant's mouth. Loaded before this
  // question is saved, so it isn't in here twice. Newest first to take the
  // latest HISTORY_LIMIT, then put back in order.
  const history = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: HISTORY_LIMIT,
    select: { role: true, text: true },
  });

  history.reverse();

  // Taken now so the question sorts before its answer when both are saved
  const askedAt = new Date();

  // A fresh LangGraph thread for every request. It only matters if this run
  // pauses for approval: the resume request continues it by this id. Not the
  // conversationId: the database already holds the conversation, and reusing
  // a thread would add every turn to its saved messages a second time.
  const threadId = crypto.randomUUID();
  const config = supervisorConfig(threadId);

  // Built per request: the HR specialists act for this session's user. The
  // shared checkpointer is what lets a later request resume a paused run.
  const supervisorCheckpointer = await getSupervisorCheckpointer();
  const agent = createSupervisorAgent(user.userId, {
    checkpointer: supervisorCheckpointer,
  });

  // Earlier turns plus this question, so follow-ups make sense
  const stream = await agent.stream(
    {
      messages: toLangChainMessages([
        ...history,
        { role: "user", text: question },
      ]),
    },
    {
      ...config,
      // "updates" for tool calls and results, "messages" for the answer as
      // it's generated; toAgentStreamEvents turns both into events
      streamMode: ["updates", "messages"],
    },
  );

  const encoder = new TextEncoder();

  const readableStream = new ReadableStream({
    async start(controller) {
      // The newline ends each event, so the browser can split them apart
      // however the bytes get chunked on the way
      const send = (event: AgentStreamEvent) =>
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));

      // Collected so the answer can be saved once streaming ends. Sources
      // are keyed by chunk id: several searches can return the same chunk.
      let answer = "";
      const sources = new Map<string, RagSource>();
      // Set when the run paused at interrupt() for approval
      let approval: Extract<AgentStreamEvent, { type: "approval" }> | undefined;
      // True once the paused run's owner is recorded and it can be resumed
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

            // Held back until the thread's owner is recorded below: the
            // client can only resume once AgentThread exists
            if (event.type === "approval") {
              approval = event;
              continue;
            }

            send(event);
          }
        }

        if (approval) {
          // One pending approval per user: two waiting leave applications
          // are confusing and could both be approved. Checked here, when
          // the run has paused, because only now is it known to be one.
          // Nothing has been written yet (the run stopped before
          // applyLeave), so a refused run is just dropped.
          resumable = await prisma.$transaction(async (tx) => {
            // Serialises this user's check-and-create, so two requests at
            // once can't both see "none pending" and both be kept
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

              // Its saved run is gone, so it can't be resumed and mustn't
              // block the user: remove the stale record
              await tx.agentThread.delete({ where: { id: other.id } });
            }

            // The ownership record for this paused run, so the resume
            // request can check it's the same user and save the outcome to
            // this conversation. The owner is always the session's user,
            // never a userId from the client; the conversation was checked
            // above to belong to that user.
            await tx.agentThread.create({
              data: { id: threadId, userId: user.userId, conversationId },
            });

            return true;
          });
        }

        if (approval && !resumable) {
          // Refused: answer like a normal turn. The paused run is deleted
          // below like any run that can't be resumed.
          approval = undefined;
          answer = APPROVAL_ALREADY_PENDING;
          send({ type: "text", content: answer });
        }

        if (approval) {
          // The question and a note that it's awaiting approval, so the
          // history doesn't end on an unanswered question
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

          // threadId is what the client sends back to approve or reject
          send({ ...approval, threadId });
        } else {
          // Gemini sometimes ends a run without streaming its reply; the
          // final message is still in the saved state, so use that
          if (!answer) {
            const state = await agent.graph.getState(config);
            const last = state.values.messages?.at(-1);

            if (AIMessage.isInstance(last) && last.text) {
              answer = last.text;
              send({ type: "text", content: answer });
            }
          }

          // Saved together and only once there's an answer, so a failed run
          // doesn't leave an unanswered question in the history
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
        // Headers (and a 200) are already sent, so the failure has to travel
        // as an event in the stream rather than as a status code
        console.error(error);
        send({ type: "error", message: streamErrorMessage(error) });
      }

      // Only a paused run with a recorded owner will ever be resumed; any
      // other run's saved state is never read again, so don't let it pile up
      if (!resumable) {
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
