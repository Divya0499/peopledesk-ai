import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "./mcp-server";

// stdout is used for MCP messages, so logs have to go to stderr
console.log = console.error;

// npm run mcp:server (MCP_USER_ID=...)
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
