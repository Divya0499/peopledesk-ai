import type { RunnableConfig } from "@langchain/core/runnables";
import { ToolNode } from "@langchain/langgraph/prebuilt";

import type { GraphState } from "./graph-state";
import { graphTools } from "./graph-tools";
import { createApplyLeaveTool } from "./langchain-tools";

// Like the static toolNode, but builds applyLeave from the requestId in the
// state on every run, so the app (not Gemini) controls the idempotency key
export async function dynamicToolNode(
  state: typeof GraphState.State,
  config?: RunnableConfig,
) {
  // Without a key a retry could deduct the leave twice, so refuse to run
  if (!state.requestId) {
    throw new Error("requestId is missing from the graph state");
  }

  const toolNode = new ToolNode([
    ...graphTools,
    createApplyLeaveTool(state.requestId),
  ]);

  // Passing config along keeps the run's callbacks and limits
  return toolNode.invoke(state, config);
}
