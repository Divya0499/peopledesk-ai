import type { Document } from "@langchain/core/documents";
import type { BaseMessage } from "@langchain/core/messages";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableLambda, RunnablePassthrough } from "@langchain/core/runnables";

import { model } from "./langchain-model";
import { rerankDocuments } from "./langchain-reranker";
import { PineconeRetriever } from "./langchain-retriever";

// Give up on reranking after this long and use Pinecone's order, so a slow
// reranker can't hold up the answer (same limit as /api/chat)
const RERANK_TIMEOUT_MS = 8000;

type RagInput = {
  question: string;
  // Earlier turns of the conversation, oldest first
  history: BaseMessage[];
};

// Searches every uploaded document
const retriever = new PineconeRetriever();

const prompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    `You are a helpful assistant.

Answer the question using only the provided context.
If the answer is not present in the context, say:
"I couldn't find that information in the provided documents."

Context:
{context}`,
  ],
  ["placeholder", "{history}"],
  ["human", "{question}"],
]);

// Inside assign() each step gets the whole input object, not just the
// question string, hence the { question } destructuring
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
      // Answer with Pinecone's order rather than failing the request
      console.error("Reranking failed, using Pinecone order", error);

      return documents;
    }
  },
);

const formatDocuments = (documents: Document[]) =>
  documents.map((doc) => doc.pageContent).join("\n\n");

// Same text the prompt tells Gemini to give when the context lacks the answer
const NOT_FOUND_ANSWER =
  "I couldn't find that information in the provided documents.";

// { question, history }
//   → + documents (retrieve + rerank)
//   → + context (documents joined into text)
//   → + text (prompt → Gemini → plain string)
//   → { text, documents }, so the caller knows which chunks were used
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
  source: string;
  section: string;
  chunkIndex: number;
  // Pinecone's vector similarity
  score: number;
  // Gemini's relevance score; missing if reranking fell back to Pinecone
  rerankScore?: number;
};

export async function askRag(question: string, history: BaseMessage[] = []) {
  const { text, documents } = await ragChain.invoke({
    question,
    history,
  });

  // Nothing was answered from these chunks, so don't list them as sources
  // (same rule as /api/chat)
  const sources: RagSource[] = text.trim().startsWith(NOT_FOUND_ANSWER)
    ? []
    : // pick() doesn't keep the documents' type
      (documents as Document[]).map((doc) => ({
        id: doc.metadata.id,
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
