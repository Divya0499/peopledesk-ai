import { tool } from "@langchain/core/tools";
import { z } from "zod";
import {
  applyLeave,
  getEmployeeDetails,
  getLeaveBalance,
  getLeavePolicy,
} from "./tools";

// Wraps the existing getLeaveBalance so the Prisma query stays in lib/tools.ts.
// The zod schema is the tool's input: it tells Gemini what to send and
// rejects anything else (e.g. a numeric userId) before the function runs.
export const getLeaveBalanceTool = tool(
  async ({ userId }) => {
    return await getLeaveBalance(userId);
  },
  {
    name: "getLeaveBalance",
    description: "Get the current leave balance of an employee.",
    schema: z.object({
      userId: z.string().describe("The employee's user ID"),
    }),
  },
);

export const getEmployeeDetailsTool = tool(
  async ({ userId }) => {
    return await getEmployeeDetails(userId);
  },
  {
    name: "getEmployeeDetails",
    description:
      "Get employee details including name, department, and leave balance.",
    schema: z.object({
      userId: z.string().describe("The employee's user ID"),
    }),
  },
);

// Takes a department, not a userId, so the agent must first look up the
// employee's department with getEmployeeDetails before it can call this.
export const getLeavePolicyTool = tool(
  async ({ department }) => {
    return getLeavePolicy(department);
  },
  {
    name: "getLeavePolicy",
    description: "Get the leave policy for a department.",
    schema: z.object({
      department: z.string().describe("The employee's department"),
    }),
  },
);

// An action tool: it writes to PostgreSQL. applyLeave() still enforces the
// leave rules and idempotency itself.
// Built per request so the application supplies requestId: the model only
// sees userId and days, and can't choose or change the idempotency key.
export function createApplyLeaveTool(requestId: string) {
  return tool(
    async ({ userId, days }) => {
      return await applyLeave(userId, days, requestId);
    },
    {
      name: "applyLeave",
      description: "Submit a leave application for an employee.",
      schema: z.object({
        userId: z.string().describe("The employee's user ID"),
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
