import { BaseRetriever } from "@langchain/core/retrievers";
import { Document } from "@langchain/core/documents";

import { searchChunks } from "./retrieval";

// Wraps searchChunks() in LangChain's retriever interface, so the embedding,
// Pinecone query and MIN_SCORE filtering stay in lib/retrieval.ts.
// Only retrieves: reranking stays a separate step.
export class PineconeRetriever extends BaseRetriever {
  lc_namespace = ["custom", "retriever"];

  constructor(
    // Optional: only search chunks from this uploaded PDF
    private readonly documentId?: string,
  ) {
    super({});
  }

  async _getRelevantDocuments(query: string): Promise<Document[]> {
    const chunks = await searchChunks(query, {
      documentId: this.documentId,
    });

    // LangChain's standard shape: the chunk text in pageContent,
    // everything else in metadata
    return chunks.map(
      (chunk) =>
        new Document({
          pageContent: chunk.text,
          metadata: {
            id: chunk.id,
            score: chunk.score,
            source: chunk.source,
            chunkIndex: chunk.chunkIndex,
            section: chunk.section,
          },
        }),
    );
  }
}
