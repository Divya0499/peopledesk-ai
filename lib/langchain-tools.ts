import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { listMyLeaveRequests, MAX_REASON_LENGTH, requestLeave } from "./leave";
import { getEmployeeDetails, getLeaveBalance } from "./tools";

// Wraps the existing getLeaveBalance so the Prisma query stays in lib/tools.ts.
// Built per request with the current employee's userId, which comes from the
// login session (getCurrentUser), never from the model: the schema has
// no userId, so no prompt, user message or retrieved document can make the
// model look up another employee.
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

// Same as getLeaveBalance: the userId is fixed when the tool is built
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

// The employee's own leave requests and their status, so the assistant can
// answer "was my leave approved?"
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

// An action tool: it writes to PostgreSQL. requestLeave() still enforces the
// leave rules and idempotency itself. It sends the request to the
// employee's manager; it doesn't approve anything.
// Built per request so the application supplies both userId and requestId:
// the model only chooses days and the reason, so it can't request leave for
// someone else or choose or change the idempotency key.
export function createApplyLeaveTool(userId: string, requestId: string) {
  return tool(
    async ({ days, reason }) => {
      const result = await requestLeave(userId, days, requestId, reason);

      // requestId is the app's idempotency key: requestLeave() and the
      // database use it, the model never needs it. Left out of what the
      // model sees, so it can't repeat it to the user whatever the prompt.
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
          // Not .positive(): that becomes exclusiveMinimum, which Gemini rejects
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
