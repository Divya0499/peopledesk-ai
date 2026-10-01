import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { CHAT_MODEL } from "@/lib/gemini";
import { getLeaveBalanceTool } from "./langchain-tools";

export const model = new ChatGoogleGenerativeAI({
  model: CHAT_MODEL,
  apiKey: process.env.GEMINI_API_KEY,
});

// Tells Gemini the tool exists; it doesn't run it. Gemini may reply with a
// tool call, and we execute that ourselves with tool.invoke().
export const modelWithTools = model.bindTools([getLeaveBalanceTool]);
