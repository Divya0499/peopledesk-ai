import { isAIMessage } from "@langchain/core/messages";
import { END, MemorySaver, START, StateGraph } from "@langchain/langgraph";

import { agentNode } from "./agent-node";
import { approvalNode } from "./approval-node";
import { dynamicToolNode } from "./dynamic-tool-node";
import { GraphState } from "./graph-state";
import { rejectionNode } from "./rejection-node";

// applyLeave needs approval first, other tools run directly
function routeAfterAgent(state: typeof GraphState.State) {
  const lastMessage = state.messages[state.messages.length - 1];

  if (!isAIMessage(lastMessage) || !lastMessage.tool_calls?.length) {
    return END;
  }

  const hasApplyLeave = lastMessage.tool_calls.some(
    (toolCall) => toolCall.name === "applyLeave",
  );

  if (hasApplyLeave) {
    return "approval";
  }

  return "tools";
}

function routeAfterApproval(state: typeof GraphState.State) {
  return state.approved ? "tools" : "rejected";
}

// START -> agent -> tools / approval -> agent ... -> END
const workflow = new StateGraph(GraphState)
  .addNode("agent", agentNode)
  .addNode("tools", dynamicToolNode)
  .addNode("approval", approvalNode)
  .addNode("rejected", rejectionNode)

  .addEdge(START, "agent")

  .addConditionalEdges("agent", routeAfterAgent, {
    approval: "approval",
    tools: "tools",
    [END]: END,
  })

  .addConditionalEdges("approval", routeAfterApproval, {
    tools: "tools",
    rejected: "rejected",
  })

  .addEdge("rejected", END)

  .addEdge("tools", "agent");

// in memory - only used for the test route, chat uses the postgres one
const checkpointer = new MemorySaver();

export const hrGraph = workflow.compile({
  checkpointer,
});
