import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "./mcp-server";

// The stdio transport uses stdout for the MCP messages themselves, so any
// console.log (getLeaveBalance has one) would corrupt them. Logs go to stderr.
console.log = console.error;

// A standalone process, separate from Next.js: an MCP client starts it and
// talks to it over stdin/stdout. Run with `npm run mcp:server`.
// The process serves one user, set by whoever starts it (createMcpClient,
// after the app has checked the session). Without one it refuses to start
// rather than serve no one or everyone.
const userId = process.env.MCP_USER_ID;

if (!userId) {
  console.error("MCP server failed to start: MCP_USER_ID is not set");
  process.exit(1);
}

createMcpServer({ userId })
  .connect(new StdioServerTransport())
  .catch((error) => {
    console.error("MCP server failed to start:", error);
    process.exit(1);
  });
