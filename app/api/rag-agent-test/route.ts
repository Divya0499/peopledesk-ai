import { isAIMessage } from "@langchain/core/messages";
import { NextResponse } from "next/server";
import { createRagAgent } from "@/lib/rag-agent";

// Calls the RAG specialist agent directly, without a supervisor, to check it
// works on its own before anything else routes questions to it.
export async function POST(req: Request) {
  try {
    const { question } = await req.json();

    if (typeof question !== "string" || !question.trim()) {
      return NextResponse.json(
        { error: "Question is required" },
        { status: 400 },
      );
    }

    const agent = createRagAgent();

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
        error: error instanceof Error ? error.message : "Something went wrong",
      },
      { status: 500 },
    );
  }
}
