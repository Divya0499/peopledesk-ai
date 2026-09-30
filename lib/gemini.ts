import { GoogleGenAI } from "@google/genai";

export const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export const CHAT_MODEL = "gemini-3.1-flash-lite";
export const EMBEDDING_MODEL = "gemini-embedding-001";

// Turn text into a vector (3072 numbers for gemini-embedding-001).
// taskType tells Gemini how the vector will be used, which improves search.
export async function embedText(text: string, taskType?: string) {
  const result = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: text,
    config: {
      taskType,
    },
  });

  const embedding = result.embeddings?.[0]?.values;

  if (!embedding) {
    throw new Error("Failed to create embedding");
  }

  return embedding;
}

// For text we store in Pinecone
export function embedDocument(text: string) {
  return embedText(text, "RETRIEVAL_DOCUMENT");
}

// For the user's question when searching Pinecone
export function embedQuery(text: string) {
  return embedText(text, "RETRIEVAL_QUERY");
}
