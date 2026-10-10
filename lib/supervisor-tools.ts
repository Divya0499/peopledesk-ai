import { HumanMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { hrGraph } from "./hr-graph";
import { graphConfig } from "./hr-graph-run";
import { askRag, type RagSource } from "./langchain-rag";
import { wrapUntrustedToolText } from "./untrusted-content";

export function hrRunId(supervisorThreadId: string, toolCallId: string) {
  return `${supervisorThreadId}:${toolCallId}`;
}

// worded so the model doesn't retry it
const LEAVE_REJECTED =
  "The employee cancelled this leave request at the confirmation step, so it was not sent to their manager. Do not retry this request. The employee can make a new leave request whenever they want.";

export function createAskHrAgentTool(userId: string) {
  return tool(
    async ({ request }, config) => {
      // on resume the tool runs again from the start, so the id has to be the
      // same both times. thread_id + tool call id are saved in the checkpoint
      const threadId = config?.configurable?.thread_id;
      const toolCallId = config?.toolCall?.id;
      const requestId =
        typeof threadId === "string" && toolCallId
          ? hrRunId(threadId, toolCallId)
          : crypto.randomUUID();

      const start = Date.now();
      console.log(`askHrAgent started at ${start}`);
      // no try/catch here! interrupt() throws GraphInterrupt and the
      // supervisor needs to get it
      const result = await hrGraph.invoke(
        {
          messages: [new HumanMessage(request)],
          userId,
          requestId,
        },
        graphConfig(requestId),
      );
      console.log(`askHrAgent finished after ${Date.now() - start}ms`);

      if (result.approved === false) {
        return LEAVE_REJECTED;
      }

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

// returns [answer, sources] - the model only sees the answer. calls the RAG
// chain directly: a RAG agent in between only picked its one tool and then
// repeated the chain's answer, two extra model calls on every policy question
export function createAskRagAgentTool() {
  return tool(
    async ({ request }): Promise<[string, RagSource[]]> => {
      const start = Date.now();
      console.log(`askRagAgent started at ${start}`);
      const { text, sources } = await askRag(request);
      console.log(`askRagAgent finished after ${Date.now() - start}ms`);

      return [wrapUntrustedToolText(text), sources];
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
