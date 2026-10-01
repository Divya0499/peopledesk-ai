import { createAgent } from "langchain";
import { model } from "./langchain-model";
import {
  getEmployeeDetailsTool,
  getLeaveBalanceTool,
  getLeavePolicyTool,
} from "./langchain-tools";

// A specialist agent: only the read-only HR tools, no RAG, applyLeave or
// memory. It's kept small so a supervisor agent can later hand it HR
// questions and trust it to stay in its lane.
// Created per request because the system prompt carries that request's userId.
export function createHrAgent(userId: string) {
  return createAgent({
    model,
    tools: [getLeaveBalanceTool, getEmployeeDetailsTool, getLeavePolicyTool],
    systemPrompt: `
You are an HR specialist.

Handle employee and leave-related requests.
Use the available HR tools when needed.
Never invent employee information.

The current employee's user ID is ${userId}. Use it for every tool that
needs a userId. Never ask the user for it or guess another ID.
`,
  });
}
