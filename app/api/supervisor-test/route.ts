import { isAIMessage } from "@langchain/core/messages";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createSupervisorAgent } from "@/lib/supervisor-agent";
import { UsageTracker } from "@/lib/usage-tracker";

// Calls the supervisor, which decides whether to hand the question to the
// HR agent. toolCalls only shows the supervisor's own calls (askHrAgent);
// the HR agent's tool calls appear in the server log via lib/tools.ts.
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

    const agent = createSupervisorAgent(user.userId);

    // Counts tokens across every model call in this request: the
    // supervisor's own and those of the agents it delegates to
    const usageTracker = new UsageTracker();
    const startedAt = Date.now();

    const result = await agent.invoke(
      { messages: [{ role: "user", content: question }] },
      { callbacks: [usageTracker] },
    );

    const usage = {
      ...usageTracker.getSummary(),
      latencyMs: Date.now() - startedAt,
    };
    console.log("Usage:", usage);

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
      usage,
    });
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
