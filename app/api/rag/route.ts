import { embedQuery } from "@/lib/gemini";
import { getIndex } from "@/lib/pinecone";

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

    // 3. Extract matching documents
    const matches = searchResult.matches ?? [];

    const documents = matches.map((match) => ({
      text: match.metadata?.text,
      source: match.metadata?.source ?? "Company notes",
      chunkIndex: match.metadata?.chunkIndex ?? 0,
      score: match.score,
    }));

    return Response.json({
      question,
      documents,
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