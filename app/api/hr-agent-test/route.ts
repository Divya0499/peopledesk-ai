import { isAIMessage } from "@langchain/core/messages";
import { NextResponse } from "next/server";
import { createHrAgent } from "@/lib/hr-agent";
import { getCurrentUser } from "@/lib/session";

// Calls the HR specialist agent directly, without a supervisor, to check it
// works on its own before anything else routes questions to it.
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

    const agent = createHrAgent(user.userId);

    const result = await agent.invoke({
      messages: [{ role: "user", content: question }],
    });

    // Every tool the agent asked for, in order, to see the path it took
    const toolCalls = result.messages.flatMap((message) =>
      isAIMessage(message)
        ? (message.tool_calls ?? []).map(({ name, args }) => ({ name, args }))
        : [],
    );

    const lastMessage = result.messages[result.messages.length - 1];

    return NextResponse.json({
      // .text rather than .content: Gemini's content can be an array of parts
      text: lastMessage.text,
      toolCalls,
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
