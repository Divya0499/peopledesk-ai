import { createAgent } from "langchain";
import { model } from "./langchain-model";
import {
  createAskHrAgentTool,
  createAskRagAgentTool,
} from "./supervisor-tools";

// The supervisor has no HR or RAG tools of its own: it only decides which
// specialist a request belongs to and delegates it.
// Created per request because the HR agent needs that request's userId.
export function createSupervisorAgent(userId: string) {
  return createAgent({
    model,
    tools: [createAskHrAgentTool(userId), createAskRagAgentTool()],
    systemPrompt: `
You are a supervisor agent.

Your job is to understand the user's request
and delegate it to the right specialist.

- For employee-specific or leave-operation requests, use askHrAgent.
- For company-document or policy questions, use askRagAgent.
- Do not answer specialized questions yourself when the appropriate specialist is available.
- Do not invent HR information.
`,
  });
}
