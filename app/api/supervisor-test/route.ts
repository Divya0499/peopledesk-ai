import { isAIMessage } from "@langchain/core/messages";
import { NextResponse } from "next/server";
import { createSupervisorAgent } from "@/lib/supervisor-agent";

// Calls the supervisor, which decides whether to hand the question to the
// HR agent. toolCalls only shows the supervisor's own calls (askHrAgent);
// the HR agent's tool calls appear in the server log via lib/tools.ts.
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const question = body.question;
    // No auth yet: like /api/langgraph-test, default to the demo employee.
    // Once there are logins this must come from the session, not the body.
    const userId =
      typeof body.userId === "string" && body.userId ? body.userId : "user-123";

    if (typeof question !== "string" || !question.trim()) {
      return NextResponse.json(
        { error: "Question is required" },
        { status: 400 },
      );
    }

    const agent = createSupervisorAgent(userId);

    const result = await agent.invoke({
      messages: [{ role: "user", content: question }],
    });

    // Every tool the supervisor asked for, in order, to see whether it delegated
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
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Something went wrong",
      },
      { status: 500 },
    );
  }
}
