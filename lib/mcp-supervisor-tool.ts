import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { createMcpAgent } from "./mcp-agent";

// The MCP agent wrapped as a supervisor tool, like askHrAgent but backed by
// MCP: the supervisor writes the request, the MCP agent answers it through
// the MCP server, and only its final answer comes back.
// Built per request because the MCP agent needs that request's userId.
export function createAskMcpHrAgentTool(userId: string) {
  return tool(
    async ({ request }) => {
      const { agent, client } = await createMcpAgent(userId);

      try {
        const result = await agent.invoke({
          messages: [{ role: "user", content: request }],
        });
        // .text rather than .content: Gemini's content can be an array of parts
        return result.messages[result.messages.length - 1].text;
      } finally {
        // Closes the MCP connection opened for this call
        await client.close();
      }
    },
    {
      name: "askMcpHrAgent",
      description:
        "Delegate the current employee's leave balance question to an MCP-backed HR agent. Not for policy questions.",
      schema: z.object({
        request: z.string().describe("The HR task to delegate"),
      }),
    },
  );
}
