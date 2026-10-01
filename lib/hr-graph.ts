import { isAIMessage } from "@langchain/core/messages";
import { END, MemorySaver, START, StateGraph } from "@langchain/langgraph";

import { agentNode } from "./agent-node";
import { approvalNode } from "./approval-node";
import { dynamicToolNode } from "./dynamic-tool-node";
import { GraphState } from "./graph-state";
import { rejectionNode } from "./rejection-node";

// After the agent: no tool calls → END, an applyLeave call → approval first
// (it writes to the database), any other tool → straight to the tool node
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

// After approval: approved → the tool node runs applyLeave, rejected → a
// reply to the user, so a rejected leave never reaches the database
function routeAfterApproval(state: typeof GraphState.State) {
  return state.approved ? "tools" : "rejected";
}

// START → agent → (tools or approval → tools/rejected) → agent … → END
// The same loop createAgent runs for us, but written out as a graph
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

  // Tool results go back to the agent, which decides what to do next
  .addEdge("tools", "agent");

// Saves the graph's state after every step, keyed by thread_id, so a run
// paused by interrupt() can be resumed later. In memory only: a server
// restart or dev hot reload loses paused runs.
const checkpointer = new MemorySaver();

export const hrGraph = workflow.compile({
  checkpointer,
});
