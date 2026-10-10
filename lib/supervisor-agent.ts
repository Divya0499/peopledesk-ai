import { type BaseMessage, isAIMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import type { BaseCheckpointSaver } from "@langchain/langgraph";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { approvalFromInterrupt, type ApprovalEvent } from "./agent-stream-events";
import { createAgent, dynamicSystemPromptMiddleware } from "langchain";
import { ASSISTANT_SCOPE_RULES } from "./assistant-scope";
import { model } from "./langchain-model";
import { getMemories } from "./memory";
import { UNTRUSTED_TOOL_RESULT_RULES } from "./untrusted-content";
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

// separate schema so prisma doesn't see these tables as drift
const CHECKPOINT_SCHEMA = "langgraph";

// same globalThis trick as lib/prisma.ts so hot reload doesn't open more pools
const globalForCheckpointer = globalThis as unknown as {
  supervisorPostgresSaver?: Promise<PostgresSaver>;
};

async function createCheckpointer() {
  // pg doesn't understand prisma's ?schema= param
  const url = new URL(process.env.DATABASE_URL!);
  url.searchParams.delete("schema");

  const saver = PostgresSaver.fromConnString(url.toString(), {
    schema: CHECKPOINT_SCHEMA,
  });

  await saver.setup();

  return saver;
}

export function getSupervisorCheckpointer() {
  globalForCheckpointer.supervisorPostgresSaver ??= createCheckpointer().catch(
    (error) => {
      // reset so the next request can retry
      globalForCheckpointer.supervisorPostgresSaver = undefined;
      throw error;
    },
  );

  return globalForCheckpointer.supervisorPostgresSaver;
}

export function supervisorConfig(threadId: string): RunnableConfig {
  return { configurable: { thread_id: threadId } };
}

// hrGraph saves under its own thread ids (see hrRunId), so those have to be
// deleted separately
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
  checkpointer?: BaseCheckpointSaver;
};

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
      dynamicSystemPromptMiddleware(async () =>
        supervisorPrompt(await getMemoryContext(userId)),
      ),
    ],
  });
}

// put memories in the prompt, gemini doesn't reliably call the tool to look them up
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
- askHrAgent returns a plain-language answer. For a leave request it
  pauses so the employee can confirm it; only then is it sent to their
  manager, who approves or rejects it later. Never say leave is approved
  just because it was sent.
- Questions about the status of the employee's own leave requests ("was my
  leave approved?") go to askHrAgent.
- If askHrAgent reports that the employee cancelled a leave request at the
  confirmation step, report that and do not call askHrAgent again to
  resubmit it. Tell the user it was not sent and that they can make a new
  request if they want.
- When one specialist's answer is needed to formulate the request for
  another (e.g. the employee's department before asking about that
  department's policy), call the first specialist, then use the relevant
  fact from its result (such as the department) in your request to the second.
- Do not answer specialized questions yourself when the appropriate specialist is available.
- Do not invent HR information.
- Never pass internal request IDs, thread IDs, tool-call IDs or other
  internal identifiers from a specialist's result on to the user.
- Combine the specialists' results into one final answer.

${UNTRUSTED_TOOL_RESULT_RULES}

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
