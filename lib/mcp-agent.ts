import { createAgent } from "langchain";
import { model } from "./langchain-model";
import { getMcpTools } from "./mcp-langchain-tools";

// An agent whose tools and context both come from the MCP server: it never
// imports lib/tools.ts, so every tool call goes agent → MCP client → MCP server.
// Returns the MCP client too: the caller must client.close() when done,
// which stops the server process started for this agent.
// Created per request because its MCP server process is bound to that
// request's user.
export async function createMcpAgent(userId: string) {
  const { client, tools } = await getMcpTools(userId);

  // The resource side of MCP: the application, not the model, reads the leave
  // policy and puts it in the prompt. The agent just sees policy text and
  // never needs to know the URI or that MCP resources exist.
  const resource = await client.readResource({
    uri: "company://policies/leave",
  });
  // Resource contents are either text or a binary blob; ours is text
  const policyText = resource.contents
    .map((content) => ("text" in content ? content.text : ""))
    .join("\n");

  const agent = createAgent({
    model,
    tools,
    systemPrompt: `
You are an HR assistant.

Use the available MCP tools when you need employee information.
Never invent employee information.
The tools always act on the current employee; never ask the user for an ID.

Company leave policy:

${policyText}

Use this policy when answering policy questions.
`,
  });

  return { agent, client };
}
