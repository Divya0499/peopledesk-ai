import type { RunnableConfig } from "@langchain/core/runnables";
import { ToolNode } from "@langchain/langgraph/prebuilt";

import type { GraphState } from "./graph-state";
import { createGraphTools } from "./graph-tools";

// Builds the tools from the userId and requestId in the state on every run,
// so the app (not Gemini) controls which employee they act on and the
// idempotency key
export async function dynamicToolNode(
  state: typeof GraphState.State,
  config?: RunnableConfig,
) {
  // Without a key a retry could deduct the leave twice, so refuse to run
  if (!state.requestId) {
    throw new Error("requestId is missing from the graph state");
  }

  // Without a userId the HR tools wouldn't know whose data to use
  if (!state.userId) {
    throw new Error("userId is missing from the graph state");
  }

  const toolNode = new ToolNode(
    createGraphTools(state.userId, state.requestId),
  );

  // Passing config along keeps the run's callbacks and limits
  return toolNode.invoke(state, config);
}
