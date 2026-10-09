import { tool } from "@langchain/core/tools";
import { z } from "zod";

import { askRag, type RagSource } from "./langchain-rag";
import { wrapUntrustedToolText } from "./untrusted-content";

// whole RAG chain as one tool. sources go in the artifact, the model only sees the answer
export const searchCompanyDocsTool = tool(
  async ({ question }): Promise<[string, RagSource[]]> => {
    const { text, sources } = await askRag(question);
    return [wrapUntrustedToolText(text), sources];
  },
  {
    name: "searchCompanyDocs",
    responseFormat: "content_and_artifact",
    description:
      "Search company documents and answer questions using information from those documents.",
    schema: z.object({
      question: z
        .string()
        .describe("The question to search in the company documents"),
    }),
  },
);
