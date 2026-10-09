import { BaseRetriever } from "@langchain/core/retrievers";
import { Document } from "@langchain/core/documents";

import { searchChunks } from "./retrieval";

export class PineconeRetriever extends BaseRetriever {
  lc_namespace = ["custom", "retriever"];

  constructor(
    private readonly documentId?: string,
  ) {
    super({});
  }

  async _getRelevantDocuments(query: string): Promise<Document[]> {
    const chunks = await searchChunks(query, {
      documentId: this.documentId,
    });

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
