import type { StructuredTool } from "@langchain/core/tools";

import { model } from "./langchain-model";
import { searchCompanyDocsTool } from "./langchain-rag-tool";
import {
  createApplyLeaveTool,
  createGetEmployeeDetailsTool,
  createGetLeaveBalanceTool,
  getLeavePolicyTool,
} from "./langchain-tools";
import {
  createGetMemoriesTool,
  createGetMemoryTool,
  createSaveMemoryTool,
} from "./memory-tools";

// One list for both graph nodes: the agent node binds these (so Gemini can
// ask for them) and the tool node runs them, so the two can't drift apart.
// Built per run from the graph state: the HR and memory tools get the
// employee's userId and applyLeave also the requestId, so Gemini can't
// choose either.
export function createGraphTools(
  userId: string,
  requestId: string,
): StructuredTool[] {
  return [
    createGetLeaveBalanceTool(userId),
    createGetEmployeeDetailsTool(userId),
    getLeavePolicyTool,
    createApplyLeaveTool(userId, requestId),
    searchCompanyDocsTool,
    createGetMemoryTool(userId),
    createGetMemoriesTool(userId),
    createSaveMemoryTool(userId),
  ];
}

// Lives here rather than in langchain-model.ts, which would create a circular
// import (langchain-model → rag tool → langchain-rag → langchain-model).
export function createModelWithTools(tools: StructuredTool[]) {
  return model.bindTools(tools);
}
