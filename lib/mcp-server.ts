import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getLeaveBalance } from "./tools";

// The MCP server with its tools and resources, and no transport attached: the
// stdio entry (mcp-server-stdio.ts), the HTTP route (app/api/mcp) and the
// in-process client (mcp-client.ts) each connect one.
// A factory because one server can only be connected to one transport, and
// the HTTP route needs a fresh one per request.
// It reuses the existing getLeaveBalance unchanged.
//
// userId is the already-authenticated user: from the login session in the
// HTTP route and the in-process client, or MCP_USER_ID for the stdio
// process. getLeaveBalance is bound to it and takes no arguments, so no MCP
// client can ask about another employee.
export function createMcpServer({ userId }: { userId: string }) {
  const server = new McpServer({
    name: "hr-mcp-server",
    version: "1.0.0",
  });

  // MCP tool results are content blocks; JSON text keeps the fields intact
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

  // A resource is data the client reads by URI, not an action the model
  // calls: the application decides when to read it and how to use it.
  // Sample text for the MCP resource demo (mcp-client-test.ts) only. The chat
  // doesn't read it: policy answers come from the uploaded documents.
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
