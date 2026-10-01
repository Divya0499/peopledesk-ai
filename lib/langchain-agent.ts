import { createAgent } from "langchain";
import { model } from "./langchain-model";
import {
  createApplyLeaveTool,
  createGetEmployeeDetailsTool,
  createGetLeaveBalanceTool,
  getLeavePolicyTool,
} from "./langchain-tools";
import { searchCompanyDocsTool } from "./langchain-rag-tool";
import { UNTRUSTED_TOOL_RESULT_RULES } from "./untrusted-content";

// The agent runs the tool loop itself: call the model, run any tools it asks
// for, send the results back, and repeat until the model answers in text.
// It takes the plain model (not modelWithTools) and binds the tools itself.
// Created per request because the HR tools need that request's userId and
// applyLeave also its requestId.
export function createLeaveAgent(userId: string, requestId: string) {
  return createAgent({
    model,
    tools: [
      createGetLeaveBalanceTool(userId),
      createGetEmployeeDetailsTool(userId),
      getLeavePolicyTool,
      createApplyLeaveTool(userId, requestId),
      // RAG as a tool: the agent decides when to search the documents
      searchCompanyDocsTool,
    ],
    // Tools say what the agent can do; the system prompt says how it behaves
    systemPrompt: `
You are an HR assistant.

When answering questions about an employee:
- Use the available tools when you need employee data.
- Never invent employee information.
- If the required information is unavailable, clearly say so.

When a user asks about company policies, rules, benefits, procedures, or
anything else contained in company documents:
- Use searchCompanyDocs.
- Never invent information that the documents don't contain.

When a user asks to apply for leave:
1. Always check their leave balance first.
2. Only call applyLeave if the requested days are less than or equal to the available balance.
3. If there is not enough balance, do not call applyLeave.
4. If applyLeave returns alreadyProcessed: true, tell the user that the same application was already submitted and no additional leave was deducted.

${UNTRUSTED_TOOL_RESULT_RULES}
`,
  });
}
