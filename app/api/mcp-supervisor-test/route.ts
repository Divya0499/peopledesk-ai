import { NextResponse } from "next/server";
import { createAskMcpHrAgentTool } from "@/lib/mcp-supervisor-tool";
import { getCurrentUser } from "@/lib/session";

// Invokes the askMcpHrAgent delegation tool directly, without a supervisor,
// to check it works before a supervisor is given it. The MCP server's log
// line shows in this server's terminal because the child process inherits
// stderr.
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

    const mcpTool = createAskMcpHrAgentTool(user.userId);

    const text = await mcpTool.invoke({ request: question });

    return NextResponse.json({ text });
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
