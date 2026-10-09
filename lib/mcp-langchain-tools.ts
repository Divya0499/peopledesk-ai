import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { createMcpClient } from "./mcp-client";

// calls getLeaveBalance through MCP. no userId, the server is already bound to the user
export function createMcpLeaveBalanceTool(client: Client) {
  return tool(
    async () => {
      const result = await client.callTool({
        name: "getLeaveBalance",
        arguments: {},
      });

      // just take the text out of the MCP content blocks
      const content = result.content as { type: string; text?: string }[];
      return content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("\n");
    },
    {
      name: "getLeaveBalance",
      description: "Get the current employee's leave balance through MCP.",
      schema: z.object({}),
    },
  );
}

// remember to client.close() after.
// TODO: build these from client.listTools() instead of by hand
export async function getMcpTools(userId: string) {
  const client = await createMcpClient(userId);

  return {
    client,
    tools: [createMcpLeaveBalanceTool(client)],
  };
}
