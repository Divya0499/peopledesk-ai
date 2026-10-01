import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  getDefaultEnvironment,
  StdioClientTransport,
} from "@modelcontextprotocol/sdk/client/stdio.js";

// Starts the stdio MCP server (lib/mcp-server-stdio.ts) as a child process
// and connects to it. The caller should client.close() when done, which also
// stops that process.
// userId must already be authenticated (from the login session): the server
// process is bound to it and its tools take no userId, so this is the only
// place the identity is chosen.
export async function createMcpClient(userId: string) {
  const client = new Client({
    name: "hr-mcp-client",
    version: "1.0.0",
  });

  const transport = new StdioClientTransport({
    command: "npm",
    // --silent: otherwise npm prints its "> learn-ai mcp:server" header to
    // stdout, which the client would try to read as an MCP message
    args: ["run", "--silent", "mcp:server"],
    // The script and its .env path are relative to the project root
    cwd: process.cwd(),
    // Setting env replaces the child's whole environment, so keep the
    // defaults (PATH, HOME, ...) that npm needs to start
    env: { ...getDefaultEnvironment(), MCP_USER_ID: userId },
  });

  await client.connect(transport);

  return client;
}
