import { NextResponse } from "next/server";

import { getConversationHistory } from "@/lib/conversation-history";
import { askRag } from "@/lib/langchain-rag";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

// LangChain RAG with the conversation's earlier messages as history, so
// follow-ups like "What about carry forward?" can be understood
export async function POST(req: Request) {
  // Who the caller is comes only from the signed session cookie
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

    // Matched on both id and owner, so another user's conversation looks the
    // same as one that doesn't exist and its history is never read
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, userId: user.userId },
      select: { id: true },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 },
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
        error: "Internal server error",
      },
      { status: 500 },
    );
  }
}
