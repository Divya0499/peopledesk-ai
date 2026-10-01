import { NextResponse } from "next/server";
import { askRag } from "@/lib/langchain-rag";

// Basic LangChain RAG (retriever → prompt → Gemini), without the reranker
// that /api/chat uses, so their answers can be compared
export async function POST(req: Request) {
  try {
    const { question } = await req.json();

    if (typeof question !== "string" || !question.trim()) {
      return NextResponse.json(
        { error: "Question is required" },
        { status: 400 },
      );
    }

    const { text, sources } = await askRag(question);

    return NextResponse.json({ text, sources });
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
