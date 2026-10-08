import { SystemMessage } from "@langchain/core/messages";

import { ASSISTANT_SCOPE_RULES } from "./assistant-scope";
import type { GraphState } from "./graph-state";
import { createGraphTools, createModelWithTools } from "./graph-tools";
import { getMemories } from "./memory";
import { UNTRUSTED_TOOL_RESULT_RULES } from "./untrusted-content";

// Tools say what the agent can do; the system prompt says how it behaves.
// The leave rules are explicit because "apply leave" also matches the
// handbook, and a policy answer must not read as a submitted application.
function systemPrompt(memoryContext: string) {
  return `
You are an HR assistant.

${ASSISTANT_SCOPE_RULES}

The tools always act on the current employee; never ask the user for an ID.

When answering questions about an employee:
- Use the available tools when you need employee data.
- Never invent employee information.
- If the required information is unavailable, clearly say so.

When a user asks about company policies, rules, benefits, procedures, or
anything else contained in company documents:
- Use searchCompanyDocs.
- Never invent information that the documents don't contain.

${UNTRUSTED_TOOL_RESULT_RULES}

When the user wants to apply for, request, submit, or take leave:
1. First call getLeaveBalance.
2. Do not use searchCompanyDocs to process the leave request.
3. If the balance covers the requested days, call applyLeave. If it doesn't,
   do not call applyLeave and tell the user their balance.
4. applyLeave needs a person's approval, which the app asks for. Don't ask
   the user to confirm first.
5. Company policy information is never confirmation that leave was
   submitted. Only a successful applyLeave result is.
6. If applyLeave returns alreadyProcessed: true, tell the user the same
   application was already submitted and no additional leave was deducted.
7. Never expose internal request IDs, thread IDs, tool-call IDs, checkpoint
   IDs, or other internal identifiers to the user, even when a tool result
   contains them. Say what happened, e.g. "Your request for 1 day of leave
   has been submitted successfully. Your remaining leave balance is now 0
   days."

You have access to user memory tools.

Relevant long-term user memories:
${memoryContext}

Memory rules:
- Use these memories when relevant to the user's request, e.g. follow a
  saved response_style in every answer.
- Use only memories relevant to the current request.
- Do not mention or expose unrelated memories.
- If no relevant memory exists, continue normally.
- Save information only when the user explicitly asks you to remember it.
- Do not save temporary information, or employee data the HR tools already
  provide (such as department or leave balance).
- Never invent memories.
- Use short snake_case keys and reuse the same key for the same kind of
  information (e.g. response_style for how the user wants answers).
`;
}

// A node takes the current state and returns only what changed. The
// messages reducer appends the response instead of replacing the history.
export async function agentNode(state: typeof GraphState.State) {
  // Built per run from the state's userId and requestId, so Gemini can ask
  // for the HR tools but never sees or chooses the employee or the
  // idempotency key.
  // bindTools() only tells Gemini the tools exist; the tool node runs them.
  const modelWithTools = createModelWithTools(
    createGraphTools(state.userId, state.requestId),
  );

  // Loaded on every run rather than left to a tool call: Gemini doesn't
  // reliably think to look up a preference like response_style by itself
  const memories = await getMemories(state.userId);
  const memoryContext = memories.length
    ? memories.map((memory) => `- ${memory.key}: ${memory.value}`).join("\n")
    : "No saved memories.";

  // Sent with every call but not saved in the state, so the stored history
  // stays just the conversation
  const response = await modelWithTools.invoke([
    new SystemMessage(systemPrompt(memoryContext)),
    ...state.messages,
  ]);

  return {
    messages: [response],
  };
}
