import { isAIMessage } from "@langchain/core/messages";
import { interrupt } from "@langchain/langgraph";

import type { GraphState } from "./graph-state";

// on resume this node runs again from the top and interrupt() returns the
// resume value. it throws to pause so don't put it in a try/catch
export async function approvalNode(state: typeof GraphState.State) {
  const lastMessage = state.messages[state.messages.length - 1];

  const toolCall = isAIMessage(lastMessage)
    ? lastMessage.tool_calls?.find((call) => call.name === "applyLeave")
    : undefined;

  // object not boolean - resume: false gives "Received empty Command input"
  const { approved } = interrupt<object, { approved: boolean }>({
    message: "Please confirm the leave request.",
    toolCall,
  });

  return {
    approved,
  };
}
