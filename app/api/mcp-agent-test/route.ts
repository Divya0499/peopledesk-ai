import { isAIMessage } from "@langchain/core/messages";
import { NextResponse } from "next/server";
import { createMcpAgent } from "@/lib/mcp-agent";
import { getCurrentUser } from "@/lib/session";

// Calls the MCP agent: its getLeaveBalance runs in the stdio MCP server
// process, not in Next.js. The server's log line shows in this server's
// terminal because the child process inherits stderr.
export async function POST(req: Request) {
  // Who the caller is comes only from the signed session cookie. A userId in
  // the body is ignored, so a caller can't act as another employee.
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const question = body.question;

    if (typeof question !== "string" || !question.trim()) {
      return NextResponse.json(
        { error: "Question is required" },
        { status: 400 },
      );
    }

    const { agent, client } = await createMcpAgent(user.userId);

    try {
      const result = await agent.invoke({
        messages: [{ role: "user", content: question }],
      });

      // Every tool the agent asked for, to see that it used the MCP tool
      const toolCalls = result.messages.flatMap((message) =>
        isAIMessage(message)
          ? (message.tool_calls ?? []).map(({ name, args }) => ({ name, args }))
          : [],
      );

      const lastMessage = result.messages[result.messages.length - 1];

      return NextResponse.json({
        text: lastMessage.text,
        toolCalls,
      });
    } finally {
      // Stops the MCP server process started for this request
      await client.close();
    }
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 },
    );
  }
}
