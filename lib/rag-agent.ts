import { createAgent } from "langchain";
import { model } from "./langchain-model";
import { searchCompanyDocsTool } from "./langchain-rag-tool";
import { UNTRUSTED_TOOL_RESULT_RULES } from "./untrusted-content";

export function createRagAgent() {
  return createAgent({
    model,
    tools: [searchCompanyDocsTool],
    systemPrompt: `
You are a company knowledge specialist.

Use searchCompanyDocs for questions about
company policies, procedures, benefits, rules,
or information contained in company documents.

Never invent information.
If the required information is not available
in the company documents, say so clearly.

${UNTRUSTED_TOOL_RESULT_RULES}
`,
  });
}
