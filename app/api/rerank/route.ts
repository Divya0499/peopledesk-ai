import { rerankChunks, type Candidate } from "@/lib/rerank";

// Standalone endpoint for testing the reranker before it's
// wired into /api/rag and /api/chat
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const question = body.question;
    const candidates: Candidate[] = body.candidates;

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

    if (
      !Array.isArray(candidates) ||
      candidates.some(
        (candidate) =>
          typeof candidate?.id !== "string" ||
          typeof candidate?.text !== "string"
      )
    ) {
      return Response.json(
        {
          error: "Candidates must be an array of { id, text }",
        },
        {
          status: 400,
        }
      );
    }

    const ranking = await rerankChunks(question, candidates);

    return Response.json({
      question,
      ranking,
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
