import { embedQuery } from "./gemini";
import { getIndex } from "./pinecone";

// found by trial and error
const MIN_SCORE = 0.5;

export type RetrievedChunk = {
  id: string;
  text: string;
  source: string;
  chunkIndex: number;
  section?: string;
  score?: number;
};

type SearchOptions = {
  documentId?: string;
};

export async function searchChunks(
  question: string,
  options: SearchOptions = {},
): Promise<RetrievedChunk[]> {
  const questionEmbedding = await embedQuery(question);

  const searchResult = await getIndex().query({
    vector: questionEmbedding,
    topK: 5,
    includeMetadata: true,
    ...(options.documentId && {
      filter: {
        documentId: { $eq: options.documentId },
      },
    }),
  });

  const matches = searchResult.matches ?? [];

  // log before filtering, useful for tuning MIN_SCORE
  console.log(
    "Retrieval scores:",
    matches.map((match) => match.score?.toFixed(3)),
  );

  return matches
    .filter((match) => (match.score ?? 0) >= MIN_SCORE)
    .map((match) => ({
      id: match.id,
      text: String(match.metadata?.text ?? ""),
      // old /api/ingest docs don't have these
      source: String(match.metadata?.source ?? "Company notes"),
      chunkIndex: Number(match.metadata?.chunkIndex ?? 0),
      section: match.metadata?.section as string | undefined,
      score: match.score,
    }))
    .filter((chunk) => chunk.text);
}
