import { Document } from "@langchain/core/documents";

import { rerankChunks } from "./rerank";

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

  // drop 0s, keep nulls
  return reranked
    .filter(({ score }) => score !== 0)
    .map(({ id, score }) => {
      const doc = byId.get(id)!;

      return new Document({
        pageContent: doc.pageContent,
        metadata: { ...doc.metadata, rerankScore: score },
      });
    });
}
