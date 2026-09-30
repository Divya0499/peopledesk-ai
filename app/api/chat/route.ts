import { ai, CHAT_MODEL, embedQuery } from "@/lib/gemini";
import { getIndex } from "@/lib/pinecone";

type ChatMessage = {
  role: "user" | "ai";
  text: string;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const messages: ChatMessage[] = body.messages;

    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json(
        {
          error: "Messages are required",
        },
        {
          status: 400,
        },
      );
    }

    // The latest message is the question we search for
    const question = messages[messages.length - 1]?.text;

    if (typeof question !== "string" || !question.trim()) {
      return Response.json(
        {
          error: "Question is required",
        },
        {
          status: 400,
        },
      );
    }

    // --------------------------------
    // 1. Create embedding for question
    // --------------------------------

    const questionEmbedding = await embedQuery(question);

    // --------------------------------
    // 2. Search Pinecone
    // --------------------------------

    // Optional: only search chunks from one uploaded PDF
    const documentId =
      typeof body.documentId === "string" && body.documentId
        ? body.documentId
        : undefined;

    const searchResult = await getIndex().query({
      vector: questionEmbedding,
      topK: 5,
      includeMetadata: true,
      ...(documentId && {
        filter: {
          documentId: { $eq: documentId },
        },
      }),
    });

    // --------------------------------
    // 3. Get relevant documents
    // --------------------------------

    const documents = (searchResult.matches ?? [])
      .map((match) => ({
        text: match.metadata?.text,
        // Documents from /api/ingest have no source or chunkIndex
        source: match.metadata?.source ?? "Company notes",
        chunkIndex: match.metadata?.chunkIndex ?? 0,
        score: match.score,
      }))
      .filter((doc) => doc.text);

    // Label each chunk with where it came from
    const context = documents
      .map(
        (doc) => `
Source: ${doc.source}
Chunk: ${doc.chunkIndex}

${doc.text}
`,
      )
      .join("\n---\n");

    // --------------------------------
    // 4. Build instructions + chat history for Gemini
    // --------------------------------
console.log(documents,"dwwef");
    const systemInstruction = `
You are a helpful company knowledge assistant.

Answer the user's question using ONLY the provided context.

If the answer cannot be found in the context, say:
"I couldn't find that information in the provided documents."

Do not make up company policies or information.

Context:
${context}
`;

    // Send the whole conversation so follow-up questions make sense
    const contents = messages.map((message) => ({
      role: message.role === "ai" ? "model" : "user",
      parts: [
        {
          text: message.text,
        },
      ],
    }));

    // --------------------------------
    // 5. Stream Gemini response
    // --------------------------------

    const stream = await ai.models.generateContentStream({
      model: CHAT_MODEL,
      config: {
        systemInstruction,
      },
      contents,
    });

    const encoder = new TextEncoder();

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.text;

            if (text) {
              controller.enqueue(encoder.encode(text));
            }
          }

          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      {
        error: error instanceof Error ? error.message : "Something went wrong",
      },
      {
        status: 500,
      },
    );
  }
}
