import { NextResponse } from "next/server";
import { chain } from "@/lib/langchain-chain";

export async function POST(req: Request) {
  try {
    const { question } = await req.json();

    if (typeof question !== "string" || !question.trim()) {
      return NextResponse.json(
        { error: "Question is required" },
        { status: 400 },
      );
    }

    // The chain fills {question} into the prompt, calls the model and
    // parses the reply, so the result is already a string
    const response = await chain.invoke({
      question,
    });

    return NextResponse.json({
      text: response,
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
