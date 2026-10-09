import type { Document } from "@langchain/core/documents";
import type { BaseMessage } from "@langchain/core/messages";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableLambda, RunnablePassthrough } from "@langchain/core/runnables";

import { model } from "./langchain-model";
import { rerankDocuments } from "./langchain-reranker";
import { PineconeRetriever } from "./langchain-retriever";
import {
  formatUntrustedDocuments,
  RAG_CHAIN_SYSTEM_PROMPT,
} from "./untrusted-content";

// if reranking is slower than this, just use pinecone's order
const RERANK_TIMEOUT_MS = 8000;

type RagInput = {
  question: string;
  history: BaseMessage[];
};

const retriever = new PineconeRetriever();

const prompt = ChatPromptTemplate.fromMessages([
  ["system", RAG_CHAIN_SYSTEM_PROMPT],
  ["placeholder", "{history}"],
  ["human", "{question}"],
]);

const retrieveAndRerank = RunnableLambda.from(
  async ({ question }: RagInput): Promise<Document[]> => {
    const documents = await retriever.invoke(question);

    console.log(
      "Retriever:",
      documents.map((doc) => `${doc.metadata.section} ${doc.metadata.score}`),
    );

    try {
      const relevantDocuments = await Promise.race([
        rerankDocuments(question, documents),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("Reranking timed out")),
            RERANK_TIMEOUT_MS,
          ),
        ),
      ]);

      console.log(
        "Relevant documents:",
        relevantDocuments.map(
          (doc) => `${doc.metadata.section} ${doc.metadata.rerankScore}`,
        ),
      );

      return relevantDocuments;
    } catch (error) {
      console.error("Reranking failed, using Pinecone order", error);

      return documents;
    }
  },
);

const formatDocuments = (documents: Document[]) =>
  formatUntrustedDocuments(
    documents.map((doc) => ({
      label: `${doc.metadata.source} · ${doc.metadata.section}`,
      text: doc.pageContent,
    })),
  );

// must match the text in the prompt
const NOT_FOUND_ANSWER =
  "I couldn't find that information in the provided documents.";

// question -> retrieve + rerank -> context -> gemini -> { text, documents }
export const ragChain = RunnablePassthrough.assign({
  documents: retrieveAndRerank,
})
  .assign({
    context: ({ documents }: { documents: Document[] }) =>
      formatDocuments(documents),
  })
  .assign({
    text: prompt.pipe(model).pipe(new StringOutputParser()),
  })
  .pick(["text", "documents"]);

export type RagSource = {
  id: string;
  text: string;
  source: string;
  section: string;
  chunkIndex: number;
  score: number;
  // not set if reranking failed
  rerankScore?: number;
};

export async function askRag(question: string, history: BaseMessage[] = []) {
  const { text, documents } = await ragChain.invoke({
    question,
    history,
  });

  // no sources if it couldn't answer
  const sources: RagSource[] = text.trim().startsWith(NOT_FOUND_ANSWER)
    ? []
    : // pick() loses the type
      (documents as Document[]).map((doc) => ({
        id: doc.metadata.id,
        text: doc.pageContent,
        source: doc.metadata.source,
        section: doc.metadata.section,
        chunkIndex: doc.metadata.chunkIndex,
        score: doc.metadata.score,
        rerankScore: doc.metadata.rerankScore,
      }));

  return {
    text,
    sources,
  };
}
