import { tool } from "@langchain/core/tools";
import { z } from "zod";

import { askRag } from "./langchain-rag";
import { wrapUntrustedToolText } from "./untrusted-content";

// Wraps the whole RAG chain (retrieve → rerank → Gemini) as one tool, so the
// agent can choose document search alongside the PostgreSQL tools.
// The agent writes the question itself, so it can turn a follow-up into a
// standalone search query before calling this.
export const searchCompanyDocsTool = tool(
  async ({ question }) => {
    const { text, sources } = await askRag(question);
    // The answer is built from uploaded documents, so it may carry text
    // someone planted there: marked as data for the agent reading it
    return { text: wrapUntrustedToolText(text), sources };
  },
  {
    name: "searchCompanyDocs",
    description:
      "Search company documents and answer questions using information from those documents.",
    schema: z.object({
      question: z
        .string()
        .describe("The question to search in the company documents"),
    }),
  },
);
