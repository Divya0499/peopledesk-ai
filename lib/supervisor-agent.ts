import { createAgent } from "langchain";
import { model } from "./langchain-model";
import {
  createAskHrAgentTool,
  createAskRagAgentTool,
} from "./supervisor-tools";
import { createAskMcpHrAgentTool } from "./mcp-supervisor-tool";

// The supervisor has no HR or RAG tools of its own: it only decides which
// specialist a request belongs to and delegates it.
// Created per request because the HR agents need that request's userId.
// askMcpHrAgent overlaps with askHrAgent; the prompt routes leave-balance
// questions to it so MCP-backed delegation can be tested deterministically.
export function createSupervisorAgent(userId: string) {
  return createAgent({
    model,
    tools: [
      createAskHrAgentTool(userId),
      createAskRagAgentTool(),
      createAskMcpHrAgentTool(userId),
    ],
    systemPrompt: `
You are a supervisor agent.

You coordinate specialized agents. Understand the user's request
and delegate each part of it to the right specialist.

- For employee-specific or leave-operation requests, use askHrAgent.
- For company-document or policy questions, use askRagAgent.
- askMcpHrAgent retrieves employee-specific information through the MCP
  system. For the current employee's leave balance, always use
  askMcpHrAgent, not askHrAgent.
- askHrAgent returns JSON: { answer, department, leaveBalance }.
- When one specialist's answer is needed to formulate the request for
  another (e.g. the employee's department before asking about that
  department's policy), call the first specialist, then use the relevant
  field from its result (such as department) in your request to the second.
- Do not answer specialized questions yourself when the appropriate specialist is available.
- Do not invent HR information.
- Combine the specialists' results into one final answer.
`,
  });
}
