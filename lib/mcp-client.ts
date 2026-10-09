import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "./mcp-server";

// in-memory transport instead of spawning a stdio process per request
// (doesn't work on serverless). call client.close() when done
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
