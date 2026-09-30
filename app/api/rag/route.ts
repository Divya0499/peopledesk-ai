import { embedQuery } from "@/lib/gemini";
import { getIndex } from "@/lib/pinecone";
import { rerankChunks } from "@/lib/rerank";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const question = body.question;

    if (typeof question !== "string" || !question.trim()) {
      return Response.json(
        {
          error: "Question is required",
        },
        {
          status: 400,
        }
      );
    } 

    // 1. Create embedding for the user's question
    const questionEmbedding = await embedQuery(question);

    // 2. Search Pinecone
    const searchResult = await getIndex().query({
      vector: questionEmbedding,
      topK: 5,
      includeMetadata: true,
    });

    // 3. Extract matching documents, in Pinecone's order
    const matches = searchResult.matches ?? [];

    const documents = matches.map((match, index) => ({
      id: match.id,
      text: String(match.metadata?.text ?? ""),
      source: match.metadata?.source ?? "Company notes",
      chunkIndex: match.metadata?.chunkIndex ?? 0,
      section: match.metadata?.section as string | undefined,
      score: match.score,
      // Position before reranking, to compare the two orders
      pineconeRank: index + 1,
    }));

    // 4. Let Gemini score each candidate by how well it answers the question.
    // If that fails (e.g. a 503), keep Pinecone's order with unknown scores
    // (null, not 0: 0 means "judged irrelevant")
    let rerankFailed = false;
    let rerankedDocuments;

    try {
      const reranked = await rerankChunks(question, documents);

      rerankedDocuments = reranked.map(({ id, score }) => ({
        ...documents.find((doc) => doc.id === id)!,
        rerankScore: score,
      }));
    } catch (error) {
      console.error("Reranking failed, using Pinecone order", error);

      rerankFailed = true;
      rerankedDocuments = documents.map((doc) => ({
        ...doc,
        rerankScore: null,
      }));
    }

    return Response.json({
      question,
      rerankFailed,
      documents: rerankedDocuments,
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Something went wrong",
      },
      {
        status: 500,
      }
    );
  }
}