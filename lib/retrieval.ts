import { embedQuery } from "./gemini";
import { getIndex } from "./pinecone";

// Matches scoring below this are too weakly related to use as context.
// A starting point, tuned by testing real questions against the documents.
const MIN_SCORE = 0.5;

export type RetrievedChunk = {
  // The Pinecone vector ID; the reranker uses it to match scores to chunks
  id: string;
  text: string;
  source: string;
  chunkIndex: number;
  section?: string;
  score?: number;
};

type SearchOptions = {
  // Only search chunks from this uploaded PDF
  documentId?: string;
};

// Embed the question, search Pinecone and keep only chunks related enough
// to use as context. Shared by the chat route and the LangChain retriever.
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

  // Logged before filtering, to help tune MIN_SCORE
  console.log(
    "Retrieval scores:",
    matches.map((match) => match.score?.toFixed(3)),
  );

  return matches
    .filter((match) => (match.score ?? 0) >= MIN_SCORE)
    .map((match) => ({
      id: match.id,
      text: String(match.metadata?.text ?? ""),
      // Documents from /api/ingest have no source or chunkIndex
      source: String(match.metadata?.source ?? "Company notes"),
      chunkIndex: Number(match.metadata?.chunkIndex ?? 0),
      section: match.metadata?.section as string | undefined,
      score: match.score,
    }))
    .filter((chunk) => chunk.text);
}
