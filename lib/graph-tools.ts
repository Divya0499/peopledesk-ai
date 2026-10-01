import type { StructuredTool } from "@langchain/core/tools";

import { model } from "./langchain-model";
import { searchCompanyDocsTool } from "./langchain-rag-tool";
import {
  getEmployeeDetailsTool,
  getLeaveBalanceTool,
  getLeavePolicyTool,
} from "./langchain-tools";
import { getMemoryTool, saveMemoryTool } from "./memory-tools";

// One list for both graph nodes: the agent node binds these (so Gemini can
// ask for them) and the tool node runs them, so the two can't drift apart.
// Read-only tools plus memory; applyLeave is added per request below.
export const graphTools = [
  getLeaveBalanceTool,
  getEmployeeDetailsTool,
  getLeavePolicyTool,
  searchCompanyDocsTool,
  getMemoryTool,
  saveMemoryTool,
];

// applyLeave is built per request by createApplyLeaveTool(requestId), so the
// application picks the idempotency key and Gemini can't invent or change it.
// Lives here rather than in langchain-model.ts, which would create a circular
// import (langchain-model → rag tool → langchain-rag → langchain-model).
export function createModelWithTools(applyLeaveTool: StructuredTool) {
  return model.bindTools([...graphTools, applyLeaveTool]);
}
