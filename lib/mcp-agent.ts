import { createAgent } from "langchain";
import { model } from "./langchain-model";
import { getMcpTools } from "./mcp-langchain-tools";

// tools come only from the MCP server (agent -> MCP client -> MCP server).
// caller has to close the client
export async function createMcpAgent(userId: string) {
  const { client, tools } = await getMcpTools(userId);

  const agent = createAgent({
    model,
    tools,
    systemPrompt: `
You are an HR assistant.

Use the available MCP tools when you need employee information.
Never invent employee information.
The tools always act on the current employee; never ask the user for an ID.
You don't have the company's policies; if asked about one, say so.
`,
  });

  return { agent, client };
}
