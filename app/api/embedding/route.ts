import { embedText } from "@/lib/gemini";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const text = body.text;

    if (typeof text !== "string" || !text.trim()) {
      return Response.json(
        {
          error: "Text is required",
        },
        {
          status: 400,
        }
      );
    }

    const embedding = await embedText(text);

    return Response.json({
      embedding,
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