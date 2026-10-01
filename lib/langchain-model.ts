import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { CHAT_MODEL } from "@/lib/gemini";

export const model = new ChatGoogleGenerativeAI({
  model: CHAT_MODEL,
  apiKey: process.env.GEMINI_API_KEY,
});
