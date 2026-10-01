import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { createHrAgent } from "./hr-agent";
import { createRagAgent } from "./rag-agent";

// The HR agent wrapped as a tool: to the supervisor it's just one more tool
// it can call. The supervisor writes the request, the HR agent runs its own
// tool loop, and only its final answer comes back.
// Built per request because the HR agent needs that request's userId.
export function createAskHrAgentTool(userId: string) {
  return tool(
    async ({ request }) => {
      const hrAgent = createHrAgent(userId);
      // Timing logs show whether both specialists run at the same time when
      // the supervisor calls them in one response (ToolNode uses Promise.all).
      const start = Date.now();
      console.log(`askHrAgent started at ${start}`);
      const result = await hrAgent.invoke({
        messages: [{ role: "user", content: request }],
      });
      console.log(`askHrAgent finished after ${Date.now() - start}ms`);
      // Structured handoff: the supervisor gets JSON with named fields rather
      // than a sentence it would have to parse.
      return JSON.stringify(result.structuredResponse);
    },
    {
      name: "askHrAgent",
      description:
        "Delegate employee-specific or leave-operation requests (the current employee's leave balance or details) to the HR specialist agent. Returns JSON: { answer, department, leaveBalance }.",
      schema: z.object({
        request: z.string().describe("The HR task to delegate"),
      }),
    },
  );
}

// Same wrapper for the RAG agent. It needs no userId: it only searches the
// company documents, so nothing in it depends on who is asking.
export function createAskRagAgentTool() {
  return tool(
    async ({ request }) => {
      const ragAgent = createRagAgent();
      const start = Date.now();
      console.log(`askRagAgent started at ${start}`);
      const result = await ragAgent.invoke({
        messages: [{ role: "user", content: request }],
      });
      console.log(`askRagAgent finished after ${Date.now() - start}ms`);
      // .text rather than .content: Gemini's content can be an array of parts
      return result.messages[result.messages.length - 1].text;
    },
    {
      name: "askRagAgent",
      description:
        "Delegate company-document and policy questions to the RAG specialist agent.",
      schema: z.object({
        request: z.string().describe("The question to delegate"),
      }),
    },
  );
}
