import { type BaseMessage, isAIMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import type { BaseCheckpointSaver } from "@langchain/langgraph";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { approvalFromInterrupt, type ApprovalEvent } from "./agent-stream-events";
import { createAgent, dynamicSystemPromptMiddleware } from "langchain";
import { ASSISTANT_SCOPE_RULES } from "./assistant-scope";
import { model } from "./langchain-model";
import { getMemories } from "./memory";
import {
  createGetMemoriesTool,
  createGetMemoryTool,
  createSaveMemoryTool,
} from "./memory-tools";
import {
  createAskHrAgentTool,
  createAskRagAgentTool,
  hrRunId,
} from "./supervisor-tools";
import { createAskMcpHrAgentTool } from "./mcp-supervisor-tool";

// Where a supervisor run paused for approval is saved, keyed by thread_id,
// so a later request can resume it with Command({ resume }). It has to be
// the supervisor's: hrGraph runs nested inside askHrAgent and saves its
// state under the supervisor's checkpointer, not its own.
// Saved in PostgreSQL, so a paused approval survives a server restart. In
// its own "langgraph" schema, apart from Prisma's tables in "public": Prisma
// only manages "public", so it never sees these tables as drift.
const CHECKPOINT_SCHEMA = "langgraph";

// One saver (and its connection pool) for the whole server, since a new
// supervisor is built per request. Kept on globalThis so a dev hot reload
// doesn't open another pool (the same trick as lib/prisma.ts).
const globalForCheckpointer = globalThis as unknown as {
  supervisorPostgresSaver?: Promise<PostgresSaver>;
};

async function createCheckpointer() {
  // ?schema= in DATABASE_URL is a Prisma setting that pg doesn't know;
  // the saver gets its schema from its own option instead
  const url = new URL(process.env.DATABASE_URL!);
  url.searchParams.delete("schema");

  const saver = PostgresSaver.fromConnString(url.toString(), {
    schema: CHECKPOINT_SCHEMA,
  });

  // Creates the schema and its tables on first use; a no-op after that
  await saver.setup();

  return saver;
}

// The shared checkpointer, set up once. Awaited because setup() has to have
// run before the first run is saved.
export function getSupervisorCheckpointer() {
  globalForCheckpointer.supervisorPostgresSaver ??= createCheckpointer().catch(
    (error) => {
      // Let the next request try again instead of failing forever
      globalForCheckpointer.supervisorPostgresSaver = undefined;
      throw error;
    },
  );

  return globalForCheckpointer.supervisorPostgresSaver;
}

// Every call to a supervisor built with a checkpointer needs this: the
// thread_id picks which saved run to continue
export function supervisorConfig(threadId: string): RunnableConfig {
  return { configurable: { thread_id: threadId } };
}

// Deletes a finished run's saved state. hrGraph runs nested inside
// askHrAgent under its own thread_id (see hrRunId), so its checkpoints
// aren't removed with the supervisor's thread and are deleted one by one,
// using the askHrAgent call ids from the supervisor's saved messages.
export async function deleteSupervisorRun(
  checkpointer: BaseCheckpointSaver,
  threadId: string,
) {
  const tuple = await checkpointer.getTuple(supervisorConfig(threadId));
  const messages = (tuple?.checkpoint.channel_values.messages ??
    []) as BaseMessage[];

  const hrThreadIds = messages.flatMap((message) =>
    isAIMessage(message)
      ? (message.tool_calls ?? [])
          .filter((call) => call.name === "askHrAgent" && call.id)
          .map((call) => hrRunId(threadId, call.id!))
      : [],
  );

  await Promise.all(
    [threadId, ...hrThreadIds].map((id) => checkpointer.deleteThread(id)),
  );
}

// The approval a paused run is waiting for, read from its saved state, with
// its threadId; undefined if the run isn't paused (finished, or its state is
// gone). Only reads: no model call, nothing runs.
export async function getPendingApproval(
  userId: string,
  threadId: string,
): Promise<ApprovalEvent | undefined> {
  const checkpointer = await getSupervisorCheckpointer();
  const agent = createSupervisorAgent(userId, { checkpointer });
  const state = await agent.graph.getState(supervisorConfig(threadId));

  for (const task of state.tasks) {
    for (const pause of task.interrupts ?? []) {
      const approval = approvalFromInterrupt(pause.value);

      if (approval) {
        return { ...approval, threadId };
      }
    }
  }

  return undefined;
}

type SupervisorOptions = {
  // Pass the saver from getSupervisorCheckpointer() to make runs resumable
  // after an approval pause. Without one there's no thread_id to supply, and
  // a pause can't be resumed.
  checkpointer?: BaseCheckpointSaver;
};

// The supervisor has no HR or RAG tools of its own: it only decides which
// specialist a request belongs to and delegates it.
// Created per request because the HR agents need that request's userId.
// askMcpHrAgent overlaps with askHrAgent; the prompt routes leave-balance
// questions to it so MCP-backed delegation can be tested deterministically.
export function createSupervisorAgent(
  userId: string,
  { checkpointer }: SupervisorOptions = {},
) {
  return createAgent({
    model,
    checkpointer,
    tools: [
      createAskHrAgentTool(userId),
      createAskRagAgentTool(),
      createAskMcpHrAgentTool(userId),
      createGetMemoryTool(userId),
      createGetMemoriesTool(userId),
      createSaveMemoryTool(userId),
    ],
    middleware: [
      // Built before every model call rather than once, so the prompt has
      // the memories as they are now (e.g. one saved earlier in this run)
      dynamicSystemPromptMiddleware(async () =>
        supervisorPrompt(await getMemoryContext(userId)),
      ),
    ],
  });
}

// Loaded into the prompt rather than left to a tool call: Gemini doesn't
// reliably think to look up a preference like response_style by itself
// (the same reason as agent-node.ts)
async function getMemoryContext(userId: string) {
  const memories = await getMemories(userId);

  return memories.length
    ? memories.map((memory) => `- ${memory.key}: ${memory.value}`).join("\n")
    : "No saved memories.";
}

function supervisorPrompt(memoryContext: string) {
  return `
You are a supervisor agent.

${ASSISTANT_SCOPE_RULES}

You coordinate specialized agents. Understand the user's request
and delegate each part of it to the right specialist.

- For employee-specific or leave-operation requests, use askHrAgent.
- For company-document or policy questions, use askRagAgent.
- askMcpHrAgent is only for the current authenticated employee's leave
  balance. For department or other employee details, use askHrAgent.
  For the current employee's leave balance, always use askMcpHrAgent,
  not askHrAgent.
- Questions about company policy, entitlement, annual allowance,
  carry-over rules, eligibility, or how many days employees receive
  should use askRagAgent.
- Questions asking about the current authenticated employee's
  personal balance or remaining leave should use askMcpHrAgent.
- Do not interpret "how many days" as personal balance unless the
  user is explicitly asking about their own remaining/current balance.
- Use previous conversation context when resolving pronouns such as
  "that", "those days", or "how many of those".
- askHrAgent returns a plain-language answer. For a leave application it
  may pause for the employee's approval; nothing is submitted before that.
- If askHrAgent reports that a leave application was rejected, declined,
  or not approved, report that result to the user and do not call
  askHrAgent again to resubmit the same leave request. A rejection is the
  employee's final decision for that request only: tell the user it was
  not submitted and that they can make a new leave request if they want.
- When one specialist's answer is needed to formulate the request for
  another (e.g. the employee's department before asking about that
  department's policy), call the first specialist, then use the relevant
  fact from its result (such as the department) in your request to the second.
- Do not answer specialized questions yourself when the appropriate specialist is available.
- Do not invent HR information.
- Never pass internal request IDs, thread IDs, tool-call IDs or other
  internal identifiers from a specialist's result on to the user.
- Combine the specialists' results into one final answer.

You handle the user's memories yourself with the memory tools; don't
delegate them.

Relevant long-term user memories:
${memoryContext}

Memory rules:
- Use these memories when relevant to the user's request, e.g. follow a
  saved response_style in every final answer.
- Use only memories relevant to the current request.
- Do not mention or expose unrelated memories.
- Save information only when the user explicitly asks you to remember it.
- Do not save temporary information, or employee data the HR tools already
  provide (such as department or leave balance).
- Never invent memories.
- Use short snake_case keys and reuse the same key for the same kind of
  information (e.g. response_style for how the user wants answers).
`;
}
