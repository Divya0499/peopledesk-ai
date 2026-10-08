import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "./mcp-server";

// Connects an MCP client to an MCP server bound to this user, inside this
// process: a linked in-memory transport pair carries the same MCP messages a
// stdio pipe or HTTP would, without starting a child process per request
// (which serverless hosts don't allow). External clients still reach the
// same server over stdio (npm run mcp:server) or HTTP (/api/mcp).
// The caller should client.close() when done, which closes both ends.
// userId must already be authenticated (from the login session): the server
// is bound to it and its tools take no userId, so this is the only place the
// identity is chosen.
export async function createMcpClient(userId: string) {
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();

  await createMcpServer({ userId }).connect(serverTransport);

  const client = new Client({
    name: "hr-mcp-client",
    version: "1.0.0",
  });

  await client.connect(clientTransport);

  return client;
}
