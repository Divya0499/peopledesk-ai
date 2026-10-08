import { tool } from "@langchain/core/tools";
import { z } from "zod";
import {
  applyLeave,
  getEmployeeDetails,
  getLeaveBalance,
} from "./tools";

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
      description: "Get the current employee's leave balance.",
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

// An action tool: it writes to PostgreSQL. applyLeave() still enforces the
// leave rules and idempotency itself.
// Built per request so the application supplies both userId and requestId:
// the model only chooses days, so it can't apply leave for someone else or
// choose or change the idempotency key.
export function createApplyLeaveTool(userId: string, requestId: string) {
  return tool(
    async ({ days }) => {
      const result = await applyLeave(userId, days, requestId);

      // requestId is the app's idempotency key: applyLeave() and the
      // database use it, the model never needs it. Left out of what the
      // model sees, so it can't repeat it to the user whatever the prompt.
      return Object.fromEntries(
        Object.entries(result).filter(([key]) => key !== "requestId"),
      );
    },
    {
      name: "applyLeave",
      description: "Submit a leave application for the current employee.",
      schema: z.object({
        days: z
          .number()
          .int()
          // Not .positive(): that becomes exclusiveMinimum, which Gemini rejects
          .min(1)
          .describe("Number of leave days"),
      }),
    },
  );
}
