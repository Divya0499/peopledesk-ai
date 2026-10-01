import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer } from "@/lib/mcp-server";
import { getCurrentUser } from "@/lib/session";

// Exposes the MCP server over Streamable HTTP at /api/mcp.
// Stateless: every request gets a fresh server and transport, with no session
// to keep between requests. enableJsonResponse returns a plain JSON response
// instead of an SSE stream, which is enough for a single tool call.
// Only POST: without sessions there's no server-to-client stream for GET to
// open, so Next.js answers GET with 405, which the MCP spec allows.
export async function POST(request: Request) {
  // Who the caller is comes only from the signed session cookie. The server's
  // getLeaveBalance is bound to this user and takes no userId, so a client
  // can't read another employee's balance.
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const server = createMcpServer({ userId: user.userId });
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  await server.connect(transport);
  return transport.handleRequest(request);
}
