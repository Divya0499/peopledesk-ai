import { createAgent } from "langchain";
import { model } from "./langchain-model";
import { getMcpTools } from "./mcp-langchain-tools";

// An agent whose tools come from the MCP server: it never imports
// lib/tools.ts, so every tool call goes agent → MCP client → MCP server.
// It doesn't read the server's leave-policy resource: policy answers come
// only from the uploaded company documents, so a hardcoded copy can't
// contradict them.
// Returns the MCP client too: the caller must client.close() when done,
// which closes the MCP connection opened for this agent.
// Created per request because its MCP server is bound to that
// request's user.
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
