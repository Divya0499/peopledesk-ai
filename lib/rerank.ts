import { Type } from "@google/genai";
import { ai, CHAT_MODEL } from "@/lib/gemini";

export type Candidate = {
  id: string;
  text: string;
  // Pinecone's similarity score, passed through untouched
  score?: number;
  section?: string;
};

export type RerankedCandidate = {
  id: string;
  // 0–10 relevance judged by Gemini; null if Gemini skipped this candidate.
  // Not comparable to Pinecone's similarity score.
  score: number | null;
};

// Ask Gemini to score each of Pinecone's candidates by how well it
// answers the question. Returns every candidate, highest score first.
export async function rerankChunks(
  question: string,
  candidates: Candidate[],
): Promise<RerankedCandidate[]> {
  if (candidates.length === 0) {
    return [];
  }

  const prompt = `
You are a document retrieval reranker.

User question:
${question}

Candidate documents:

${candidates
  .map(
    (candidate, index) => `
Candidate ${index + 1}
ID: ${candidate.id}
Section: ${candidate.section ?? "Unknown"}
Text:
${candidate.text}
`,
  )
  .join("\n")}

For every candidate, assign a relevance score from 0 to 10
for answering the user's question.

10 = directly answers the question
7-9 = highly relevant
5-6 = moderately relevant
3-4 = somewhat related
1-2 = barely related
0 = irrelevant

Judge each candidate on its own. If no candidate helps answer
the question, give them all 0.
`;

  const response = await ai.models.generateContent({
    model: CHAT_MODEL,
    contents: prompt,
    config: {
      // Makes Gemini return bare JSON in this shape (no code fences)
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            score: { type: Type.INTEGER },
          },
          required: ["id", "score"],
        },
      },
    },
  });

  const judged = JSON.parse(response.text ?? "[]") as {
    id: string;
    score: number;
  }[];

  // Only trust scores for real candidate IDs, clamped to 0–10;
  // the first score wins if Gemini repeats an ID
  const scores = new Map<string, number>();

  for (const { id, score } of judged) {
    if (!scores.has(id) && Number.isFinite(score)) {
      scores.set(id, Math.min(10, Math.max(0, Math.round(score))));
    }
  }

  // Every candidate comes back, even ones Gemini skipped (score null, last).
  // Ties keep Pinecone's order because sort is stable.
  return candidates
    .map((candidate) => ({
      id: candidate.id,
      score: scores.get(candidate.id) ?? null,
    }))
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
}
