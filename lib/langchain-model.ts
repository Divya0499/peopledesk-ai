import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { CHAT_MODEL } from "@/lib/gemini";

// Used while someone waits for a chat answer. When Gemini is busy (503) or
// rate limited (429), LangChain retries with growing waits; the default of 6
// retries could keep the user waiting over a minute. 2 retries fail within a
// few seconds and the chat shows "The AI model is busy right now".
export const model = new ChatGoogleGenerativeAI({
  model: CHAT_MODEL,
  apiKey: process.env.GEMINI_API_KEY,
  maxRetries: 2,
});

// Used in the background (checking uploaded PDFs), where nobody is waiting,
// so it keeps the default retries rather than failing the upload
export const backgroundModel = new ChatGoogleGenerativeAI({
  model: CHAT_MODEL,
  apiKey: process.env.GEMINI_API_KEY,
});
