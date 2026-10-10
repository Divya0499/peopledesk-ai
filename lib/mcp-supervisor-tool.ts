import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { createMcpClient } from "./mcp-client";
import { createMcpLeaveBalanceTool } from "./mcp-langchain-tools";

// Gets the leave balance through MCP: supervisor -> MCP client -> MCP server.
// It calls the MCP tool directly; an agent in between only picked that one
// tool and restated its result, two extra model calls for a 0.1s lookup.
export function createAskMcpHrAgentTool(userId: string) {
  return tool(
    async () => {
      const client = await createMcpClient(userId);

      try {
        return await createMcpLeaveBalanceTool(client).invoke({});
      } finally {
        await client.close();
      }
    },
    {
      name: "askMcpHrAgent",
      description:
        "Get the current employee's leave balance (days available and days pending approval) from the HR MCP server. Not for policy questions.",
      schema: z.object({
        request: z
          .string()
          .optional()
          .describe("The employee's question; not needed to look it up"),
      }),
    },
  );
}
