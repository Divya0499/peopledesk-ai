import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { listMyLeaveRequests, MAX_REASON_LENGTH, requestLeave } from "./leave";
import { getEmployeeDetails, getLeaveBalance } from "./tools";

// userId comes from the session, not from the model, so it can't look up
// someone else
export function createGetLeaveBalanceTool(userId: string) {
  return tool(
    async () => {
      return await getLeaveBalance(userId);
    },
    {
      name: "getLeaveBalance",
      description:
        "Get the current employee's leave balance (days they can still request) and how many days are in pending requests.",
      schema: z.object({}),
    },
  );
}

export function createGetEmployeeDetailsTool(userId: string) {
  return tool(
    async () => {
      return await getEmployeeDetails(userId);
    },
    {
      name: "getEmployeeDetails",
      description:
        "Get the current employee's details including name, department, and leave balance.",
      schema: z.object({}),
    },
  );
}

export function createGetMyLeaveRequestsTool(userId: string) {
  return tool(
    async () => {
      const requests = await listMyLeaveRequests(userId, 10);

      return requests.map((request) => ({
        days: request.days,
        reason: request.reason,
        status: request.status,
        requestedOn: request.createdAt.toISOString().slice(0, 10),
        decidedBy: request.decidedBy?.name ?? null,
        decisionNote: request.decisionNote,
      }));
    },
    {
      name: "getMyLeaveRequests",
      description:
        "List the current employee's 10 most recent leave requests with their status (pending, approved, rejected or cancelled).",
      schema: z.object({}),
    },
  );
}

// model only picks days + reason. userId and requestId are set by us
export function createApplyLeaveTool(userId: string, requestId: string) {
  return tool(
    async ({ days, reason }) => {
      const result = await requestLeave(userId, days, requestId, reason);

      // don't show requestId to the model
      return Object.fromEntries(
        Object.entries(result).filter(([key]) => key !== "requestId"),
      );
    },
    {
      name: "applyLeave",
      description:
        "Send a leave request for the current employee to their manager for approval. The days are reserved until the manager decides.",
      schema: z.object({
        days: z
          .number()
          .int()
          // .positive() gives exclusiveMinimum which gemini doesn't accept
          .min(1)
          .describe("Number of leave days"),
        reason: z
          .string()
          .max(MAX_REASON_LENGTH)
          .optional()
          .describe("The reason the employee gave, if any"),
      }),
    },
  );
}
