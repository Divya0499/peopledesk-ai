import { ai, CHAT_MODEL, embedQuery } from "@/lib/gemini";
import { getIndex } from "@/lib/pinecone";
import { prisma } from "@/lib/prisma";

// Matches scoring below this are too weakly related to use as context.
// A starting point, tuned by testing real questions against the documents.
const MIN_SCORE = 0.5;

type ChatMessage = {
  role: "user" | "ai";
  text: string;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const messages: ChatMessage[] = body.messages;
    const conversationId = body.conversationId;

    if (typeof conversationId !== "string" || !conversationId.trim()) {
      return Response.json(
        {
          error: "Conversation is required",
        },
        {
          status: 400,
        },
      );
    }

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

    // Save the user's question to the conversation
    await prisma.message.create({
      data: {
        conversationId,
        role: "user",
        text: question,
      },
    });

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
    // 3. Get relevant chunks (also the answer's sources)
    // --------------------------------

    const matches = searchResult.matches ?? [];

    // Logged before filtering, to help tune MIN_SCORE
    console.log(
      "Retrieval scores:",
      matches.map((match) => match.score?.toFixed(3)),
    );

    const sources = matches
      .filter((match) => (match.score ?? 0) >= MIN_SCORE)
      .map((match) => ({
        id: match.id,
        text: match.metadata?.text,
        // Documents from /api/ingest have no source or chunkIndex
        source: match.metadata?.source ?? "Company notes",
        chunkIndex: match.metadata?.chunkIndex ?? 0,
        score: match.score,
      }))
      .filter((doc) => doc.text);

    // Label each chunk with where it came from
    const context = sources
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

    // Each event is one JSON object per line (NDJSON), so text and
    // sources can share one stream
    const encodeEvent = (event: object) =>
      encoder.encode(JSON.stringify(event) + "\n");

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          // Collect the full answer so it can be saved once streaming ends
          let result = "";

          for await (const chunk of stream) {
            const text = chunk.text;

            if (text) {
              result += text;
              controller.enqueue(encodeEvent({ type: "text", text }));
            }
          }

          // Sent after the answer so the UI can list them under it
          controller.enqueue(encodeEvent({ type: "sources", sources }));

          if (result) {
            await prisma.message.create({
              data: {
                conversationId,
                role: "ai",
                text: result,
                sources,
              },
            });
          }

          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
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
