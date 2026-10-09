import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getLeaveBalance } from "./tools";

// factory because a server can only connect to one transport
// (used by stdio, the /api/mcp route and the in-process client)
export function createMcpServer({ userId }: { userId: string }) {
  const server = new McpServer({
    name: "hr-mcp-server",
    version: "1.0.0",
  });

  async function leaveBalanceResult() {
    const result = await getLeaveBalance(userId);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result) }],
    };
  }

  server.registerTool(
    "getLeaveBalance",
    {
      title: "Get leave balance",
      description: "Get the current employee's leave balance.",
      inputSchema: {},
    },
    async () => leaveBalanceResult(),
  );

  // just for trying out MCP resources (mcp-client-test.ts), the chat doesn't use it
  server.registerResource(
    "leave-policy",
    "company://policies/leave",
    {
      title: "Leave policy",
      description: "Company leave policy",
      mimeType: "text/plain",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "text/plain",
          text: `
Annual Leave: 24 days per year.
Carry Forward: Up to 8 unused days.
Sick Leave: 10 days per year and cannot be carried forward.
Parental Leave: 26 weeks for primary caregivers and 4 weeks for secondary caregivers.
Leave requests for more than 5 consecutive days require at least two weeks' notice.
`.trim(),
        },
      ],
    }),
  );

  return server;
}
