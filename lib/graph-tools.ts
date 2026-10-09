import type { StructuredTool } from "@langchain/core/tools";

import { model } from "./langchain-model";
import { searchCompanyDocsTool } from "./langchain-rag-tool";
import {
  createApplyLeaveTool,
  createGetEmployeeDetailsTool,
  createGetLeaveBalanceTool,
  createGetMyLeaveRequestsTool,
} from "./langchain-tools";
import {
  createGetMemoriesTool,
  createGetMemoryTool,
  createSaveMemoryTool,
} from "./memory-tools";

// used by both the agent node and the tool node so they stay in sync
export function createGraphTools(
  userId: string,
  requestId: string,
): StructuredTool[] {
  return [
    createGetLeaveBalanceTool(userId),
    createGetEmployeeDetailsTool(userId),
    createGetMyLeaveRequestsTool(userId),
    createApplyLeaveTool(userId, requestId),
    searchCompanyDocsTool,
    createGetMemoryTool(userId),
    createGetMemoriesTool(userId),
    createSaveMemoryTool(userId),
  ];
}

// here and not in langchain-model.ts because of a circular import
export function createModelWithTools(tools: StructuredTool[]) {
  return model.bindTools(tools);
}
