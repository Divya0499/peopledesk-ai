import { ToolNode } from "@langchain/langgraph/prebuilt";

import { graphTools } from "./graph-tools";

// Runs every tool call in the last AIMessage and adds one ToolMessage per
// call to the state
export const toolNode = new ToolNode(graphTools);
