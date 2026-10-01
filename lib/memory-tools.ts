import { tool } from "@langchain/core/tools";
import { z } from "zod";

import { getMemory, saveMemory } from "./memory";

// LLM-callable wrappers around lib/memory.ts, so the agent can decide when to
// remember something about a user and when to look it up again.
export const saveMemoryTool = tool(
  async ({ userId, key, value }) => {
    await saveMemory(userId, key, value);

    return {
      success: true,
      message: "Memory saved successfully.",
    };
  },
  {
    name: "saveMemory",
    description: "Save useful user information for future conversations.",
    schema: z.object({
      userId: z.string().describe("The user's ID"),
      key: z.string().describe("What the memory is about, e.g. response_style"),
      value: z.string().describe("The information to remember"),
    }),
  },
);

export const getMemoryTool = tool(
  async ({ userId, key }) => {
    const memory = await getMemory(userId, key);

    if (!memory) {
      return {
        found: false,
        message: "No memory found.",
      };
    }

    return {
      found: true,
      key: memory.key,
      value: memory.value,
    };
  },
  {
    name: "getMemory",
    description: "Retrieve previously saved information about a user.",
    schema: z.object({
      userId: z.string().describe("The user's ID"),
      key: z.string().describe("What the memory is about, e.g. response_style"),
    }),
  },
);
