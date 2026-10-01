import { createMcpClient } from "./mcp-client";

// Checks the full MCP flow: connects to the stdio MCP server, lists the tools
// it offers, calls getLeaveBalance, then reads the leave policy resource.
// The server is started for user-123: a local script stands in for the login
// session that picks the user in the app.
// Run with `npm run mcp:client-test`.
// Wrapped in a function because tsx runs this file as CommonJS, which has no
// top-level await.
async function main() {
  const client = await createMcpClient("user-123");

  try {
    const tools = await client.listTools();
    console.log("Available tools:");
    console.dir(tools.tools, { depth: null });

    const result = await client.callTool({
      name: "getLeaveBalance",
      arguments: {},
    });
    console.log("Tool result:");
    console.dir(result, { depth: null });

    const resource = await client.readResource({
      uri: "company://policies/leave",
    });
    console.log("Resource:");
    console.dir(resource, { depth: null });
  } finally {
    // Also stops the server child process
    await client.close();
  }
}

main().catch((error) => {
  console.error("MCP client test failed:", error);
  process.exit(1);
});
