import { createAgent, toolStrategy } from "langchain";
import { z } from "zod";
import { model } from "./langchain-model";
import {
  createGetEmployeeDetailsTool,
  createGetLeaveBalanceTool,
} from "./langchain-tools";

// A specialist agent: only the read-only HR tools, no RAG, applyLeave or
// memory. It's kept small so a supervisor agent can later hand it HR
// questions and trust it to stay in its lane.
// Created per request because its tools are built with that request's userId.

// The HR agent's contract with whoever calls it: fields the supervisor can
// read directly (e.g. department for a RAG policy question) instead of
// parsing them out of free text.
export const hrResultSchema = z.object({
  answer: z.string().describe("The answer to the HR request, in plain language"),
  // .optional() rather than .nullable(): nullable becomes a type array
  // (["string", "null"]) in the JSON schema, which Gemini rejects
  department: z
    .string()
    .optional()
    .describe("The employee's department, if it was looked up; otherwise omit"),
  leaveBalance: z
    .number()
    .optional()
    .describe("The employee's leave balance in days, if it was looked up; otherwise omit"),
});

export function createHrAgent(userId: string) {
  return createAgent({
    model,
    tools: [
      createGetLeaveBalanceTool(userId),
      createGetEmployeeDetailsTool(userId),
    ],
    // toolStrategy: the model returns the result by calling a generated tool,
    // which works with Gemini alongside the other tools.
    responseFormat: toolStrategy(hrResultSchema),
    systemPrompt: `
You are an HR specialist.

Handle employee and leave-related requests.
Use the available HR tools when needed.
Never invent employee information.
The tools always act on the current employee; never ask the user for an ID.
`,
  });
}
