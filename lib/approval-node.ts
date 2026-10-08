import { isAIMessage } from "@langchain/core/messages";
import { interrupt } from "@langchain/langgraph";

import type { GraphState } from "./graph-state";

// interrupt() pauses the graph here and hands its value to the caller. When
// the graph is resumed with new Command({ resume }), this node runs again
// from the top and interrupt() returns that resume value instead.
// It pauses by throwing, so never wrap it in a try/catch.
export async function approvalNode(state: typeof GraphState.State) {
  const lastMessage = state.messages[state.messages.length - 1];

  // The leave request the agent wants to submit, so the person approving
  // sees exactly what they're agreeing to (e.g. 3 days for user-123)
  const toolCall = isAIMessage(lastMessage)
    ? lastMessage.tool_calls?.find((call) => call.name === "applyLeave")
    : undefined;

  // Typed as the resume value. An object, not a bare boolean: LangGraph
  // ignores a falsy resume, so Command({ resume: false }) fails with
  // "Received empty Command input" and a rejection could never resume.
  const { approved } = interrupt<object, { approved: boolean }>({
    message: "Please confirm the leave request.",
    toolCall,
  });

  return {
    approved,
  };
}
