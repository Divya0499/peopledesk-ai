import { z } from "zod";
import { model } from "./langchain-model";

// The shape every reply must have, so callers can read response.success
// instead of searching the text for words like "successful"
const responseSchema = z.object({
  answer: z.string(),
  success: z.boolean(),
});

// Returns a validated { answer, success } object instead of an AIMessage
export const structuredModel = model.withStructuredOutput(responseSchema);
