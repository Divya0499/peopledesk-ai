import { Document } from "@langchain/core/documents";

import { rerankChunks } from "./rerank";

// Adapter: lets LangChain Documents use the existing Gemini reranker.
// rerankChunks() returns only { id, score }, so results are matched back to
// the original Documents by id rather than rebuilt from the reranker output.
export async function rerankDocuments(
  question: string,
  documents: Document[],
): Promise<Document[]> {
  const candidates = documents.map((doc) => ({
    id: String(doc.metadata.id),
    text: doc.pageContent,
    score: doc.metadata.score as number | undefined,
    section: doc.metadata.section as string | undefined,
  }));

  const reranked = await rerankChunks(question, candidates);

  const byId = new Map(documents.map((doc) => [String(doc.metadata.id), doc]));

  // Most relevant first; drop chunks judged irrelevant (0), as /api/chat does.
  // A null score (Gemini skipped it) is unknown, so it's kept.
  return reranked
    .filter(({ score }) => score !== 0)
    .map(({ id, score }) => {
      const doc = byId.get(id)!;

      // Kept apart from metadata.score: Pinecone's score is vector
      // similarity, the reranker's is Gemini's 0–10 relevance judgement
      return new Document({
        pageContent: doc.pageContent,
        metadata: { ...doc.metadata, rerankScore: score },
      });
    });
}
