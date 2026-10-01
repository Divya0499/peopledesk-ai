import { NextResponse } from "next/server";
import { HumanMessage } from "@langchain/core/messages";
import { model } from "@/lib/langchain-model";
import { createGetLeaveBalanceTool } from "@/lib/langchain-tools";
import { getCurrentUser } from "@/lib/session";

// A manual tool loop: Gemini asks for a tool, we run it, send the result
// back, and Gemini writes the final answer.
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

    // Built with the session's userId, so Gemini only asks for the tool and
    // can't choose whose balance it reads
    const getLeaveBalanceTool = createGetLeaveBalanceTool(user.userId);

    // Tells Gemini the tool exists; it doesn't run it. Gemini may reply with a
    // tool call, and we execute that ourselves with tool.invoke().
    const modelWithTools = model.bindTools([getLeaveBalanceTool]);

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
        error: "Internal server error",
      },
      { status: 500 },
    );
  }
}
