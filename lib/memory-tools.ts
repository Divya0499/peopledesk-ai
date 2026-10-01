import { tool } from "@langchain/core/tools";
import { z } from "zod";

import { getMemories, getMemory, saveMemory } from "./memory";

// LLM-callable wrappers around lib/memory.ts, so the agent can decide when to
// remember something about a user and when to look it up again.
// Built per request with the current user's userId from the signed session:
// the schemas have no userId, so the model can't read or overwrite another
// user's memories.

export function createSaveMemoryTool(userId: string) {
  return tool(
    async ({ key, value }) => {
      await saveMemory(userId, key, value);

      return {
        success: true,
        message: "Memory saved successfully.",
      };
    },
    {
      name: "saveMemory",
      description:
        "Save useful information about the current user for future conversations.",
      schema: z.object({
        key: z
          .string()
          .describe("What the memory is about, e.g. response_style"),
        value: z.string().describe("The information to remember"),
      }),
    },
  );
}

export function createGetMemoryTool(userId: string) {
  return tool(
    async ({ key }) => {
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
      description:
        "Retrieve previously saved information about the current user.",
      schema: z.object({
        key: z
          .string()
          .describe("What the memory is about, e.g. response_style"),
      }),
    },
  );
}

// Returns every memory at once, so the agent doesn't have to guess the exact
// key that getMemory needs
export function createGetMemoriesTool(userId: string) {
  return tool(
    async () => {
      const memories = await getMemories(userId);

      return {
        found: memories.length > 0,
        memories: memories.map((memory) => ({
          key: memory.key,
          value: memory.value,
        })),
      };
    },
    {
      name: "getMemories",
      description:
        "Retrieve all saved long-term memories for the current user.",
      schema: z.object({}),
    },
  );
}
