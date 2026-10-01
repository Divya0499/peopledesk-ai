import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { createMcpClient } from "./mcp-client";

// The MCP server's getLeaveBalance as a LangChain tool. The agent never
// imports getLeaveBalance: each call goes through the MCP client to the
// server process.
// Takes no userId: the client's server process is already bound to the
// session's user (see getMcpTools), so neither the model nor this call can
// ask the MCP server about another employee.
export function createMcpLeaveBalanceTool(client: Client) {
  return tool(
    async () => {
      const result = await client.callTool({
        name: "getLeaveBalance",
        arguments: {},
      });

      // MCP returns content blocks; the agent only needs their text (the
      // JSON getLeaveBalance produced), not the MCP wrapper around it
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

// Starts an MCP server process bound to this userId (from the login session),
// connects to it, and bridges its tools into LangChain tools an agent can use.
// The caller must client.close() when done, which also stops the process.
// A hand-written first adapter; a generic one would build these from
// client.listTools() instead.
export async function getMcpTools(userId: string) {
  const client = await createMcpClient(userId);

  return {
    client,
    tools: [createMcpLeaveBalanceTool(client)],
  };
}
