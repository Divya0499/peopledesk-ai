import { HumanMessage, ToolMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { hrGraph } from "./hr-graph";
import { graphConfig } from "./hr-graph-run";
import type { RagSource } from "./langchain-rag";
import { createRagAgent } from "./rag-agent";

// The id askHrAgent gives one call's hrGraph run: its applyLeave
// idempotency key and its thread_id. Built from the supervisor's thread_id
// and the tool call's id, both saved in the supervisor's checkpoint, so it
// comes out the same when the tool runs again on resume.
export function hrRunId(supervisorThreadId: string, toolCallId: string) {
  return `${supervisorThreadId}:${toolCallId}`;
}

// What the supervisor gets back when the employee rejected the leave. Worded
// so the model can't read it as a temporary failure worth retrying: a
// rejection is final for that request.
const LEAVE_REJECTED =
  "The employee cancelled this leave request at the confirmation step, so it was not sent to their manager. Do not retry this request. The employee can make a new leave request whenever they want.";

// The HR graph wrapped as a tool: to the supervisor it's just one more tool
// it can call. The supervisor writes the request, hrGraph runs its own loop
// (balance and employee tools, applyLeave behind an approval), and only its
// final answer comes back.
// A leave application pauses inside hrGraph at interrupt(). Running nested
// in this tool, that pause reaches the supervisor, which saves it if it was
// built with a checkpointer; resuming the supervisor runs this tool again
// and hrGraph continues from where it paused.
// Built per request because hrGraph acts for that request's userId.
export function createAskHrAgentTool(userId: string) {
  return tool(
    async ({ request }, config) => {
      // applyLeave's idempotency key. Not a fresh UUID: on resume this tool
      // runs again from the top, so the key has to come out the same. The
      // supervisor's thread_id and this tool call's id are both saved in its
      // checkpoint, so they are. Without a checkpointer a run can't be
      // resumed, and any unique key will do.
      const threadId = config?.configurable?.thread_id;
      const toolCallId = config?.toolCall?.id;
      const requestId =
        typeof threadId === "string" && toolCallId
          ? hrRunId(threadId, toolCallId)
          : crypto.randomUUID();

      // Timing logs show whether both specialists run at the same time when
      // the supervisor calls them in one response (ToolNode uses Promise.all).
      const start = Date.now();
      console.log(`askHrAgent started at ${start}`);
      // Never wrap this in try/catch: a leave application pauses by
      // throwing GraphInterrupt, which must reach the supervisor
      const result = await hrGraph.invoke(
        {
          messages: [new HumanMessage(request)],
          userId,
          requestId,
        },
        // hrGraph's thread must also come out the same when this tool runs
        // again on resume: its saved pause is looked up by it, and with a new
        // id hrGraph would start over and ask for approval again.
        // requestId is stable across a resume and unique per request.
        graphConfig(requestId),
      );
      console.log(`askHrAgent finished after ${Date.now() - start}ms`);

      // false only when the person rejected a leave application at the
      // approval step (unset when nothing needed approval)
      if (result.approved === false) {
        return LEAVE_REJECTED;
      }

      // .text rather than .content: Gemini's content can be an array of parts
      return result.messages[result.messages.length - 1].text;
    },
    {
      name: "askHrAgent",
      description:
        "Delegate employee-specific or leave-operation requests (the current employee's leave balance or details, or applying for leave) to the HR specialist agent. A leave application waits for the employee's approval before anything is submitted.",
      schema: z.object({
        request: z.string().describe("The HR task to delegate"),
      }),
    },
  );
}

// Same wrapper for the RAG agent. It needs no userId: it only searches the
// company documents, so nothing in it depends on who is asking.
// Returns [answer, sources]: the supervisor's model sees only the answer,
// and the sources travel on as the ToolMessage's artifact for the app.
export function createAskRagAgentTool() {
  return tool(
    async ({ request }): Promise<[string, RagSource[]]> => {
      const ragAgent = createRagAgent();
      const start = Date.now();
      console.log(`askRagAgent started at ${start}`);
      const result = await ragAgent.invoke({
        messages: [{ role: "user", content: request }],
      });
      console.log(`askRagAgent finished after ${Date.now() - start}ms`);

      // The agent may search more than once; keyed by chunk id so a chunk
      // found by two searches is listed once
      const sources = new Map<string, RagSource>();

      for (const message of result.messages) {
        if (
          ToolMessage.isInstance(message) &&
          message.name === "searchCompanyDocs" &&
          Array.isArray(message.artifact)
        ) {
          for (const source of message.artifact as RagSource[]) {
            sources.set(source.id, source);
          }
        }
      }

      // .text rather than .content: Gemini's content can be an array of parts
      return [
        result.messages[result.messages.length - 1].text,
        [...sources.values()],
      ];
    },
    {
      name: "askRagAgent",
      responseFormat: "content_and_artifact",
      description:
        "Delegate company-document and policy questions to the RAG specialist agent.",
      schema: z.object({
        request: z.string().describe("The question to delegate"),
      }),
    },
  );
}
