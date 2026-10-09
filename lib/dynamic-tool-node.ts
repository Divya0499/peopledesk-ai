import type { RunnableConfig } from "@langchain/core/runnables";
import { ToolNode } from "@langchain/langgraph/prebuilt";

import type { GraphState } from "./graph-state";
import { createGraphTools } from "./graph-tools";

export async function dynamicToolNode(
  state: typeof GraphState.State,
  config?: RunnableConfig,
) {
  if (!state.requestId) {
    throw new Error("requestId is missing from the graph state");
  }

  if (!state.userId) {
    throw new Error("userId is missing from the graph state");
  }

  const toolNode = new ToolNode(
    createGraphTools(state.userId, state.requestId),
  );

  return toolNode.invoke(state, config);
}
