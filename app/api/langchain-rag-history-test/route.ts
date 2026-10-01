import { NextResponse } from "next/server";

import { getConversationHistory } from "@/lib/conversation-history";
import { askRag } from "@/lib/langchain-rag";

// LangChain RAG with the conversation's earlier messages as history, so
// follow-ups like "What about carry forward?" can be understood
export async function POST(req: Request) {
  try {
    const { conversationId, question } = await req.json();

    if (typeof conversationId !== "string" || !conversationId.trim()) {
      return NextResponse.json(
        { error: "Conversation ID is required" },
        { status: 400 },
      );
    }

    if (typeof question !== "string" || !question.trim()) {
      return NextResponse.json(
        { error: "Question is required" },
        { status: 400 },
      );
    }

    const history = await getConversationHistory(conversationId);

    const { text, sources } = await askRag(question, history);

    return NextResponse.json({
      text,
      sources,
      historyCount: history.length,
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
