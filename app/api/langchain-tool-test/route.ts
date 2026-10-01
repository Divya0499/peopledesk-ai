import { NextResponse } from "next/server";
import { HumanMessage } from "@langchain/core/messages";
import { modelWithTools } from "@/lib/langchain-model";
import { getLeaveBalanceTool } from "@/lib/langchain-tools";

// A manual tool loop: Gemini asks for a tool, we run it, send the result
// back, and Gemini writes the final answer.
export async function POST(req: Request) {
  try {
    const { question } = await req.json();

    if (typeof question !== "string" || !question.trim()) {
      return NextResponse.json(
        { error: "Question is required" },
        { status: 400 },
      );
    }

    const userMessage = new HumanMessage(question);

    const firstResponse = await modelWithTools.invoke([userMessage]);

    const toolCall = firstResponse.tool_calls?.[0];

    // Gemini answered in text, so there's no tool to run
    if (!toolCall) {
      return NextResponse.json({
        text: firstResponse.text,
      });
    }

    // Only one tool is bound for now; guard so a future tool's call
    // isn't passed to the wrong function
    if (toolCall.name !== getLeaveBalanceTool.name) {
      return NextResponse.json(
        { error: `Unknown tool: ${toolCall.name}` },
        { status: 400 },
      );
    }

    // Passing the whole tool call (not just its args) runs the existing
    // getLeaveBalance() and returns a ToolMessage whose tool_call_id matches
    // the call, so Gemini knows which request this result answers.
    const toolMessage = await getLeaveBalanceTool.invoke(toolCall);

    // The whole exchange so far: question, Gemini's tool call, tool result
    const finalResponse = await modelWithTools.invoke([
      userMessage,
      firstResponse,
      toolMessage,
    ]);

    return NextResponse.json({
      text: finalResponse.text,
      toolCall,
      toolResult: toolMessage.content,
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
