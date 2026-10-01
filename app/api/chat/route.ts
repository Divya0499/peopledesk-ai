import { ApiError } from "@google/genai";
import { ai, CHAT_MODEL } from "@/lib/gemini";
import { prisma } from "@/lib/prisma";
import { rerankChunks } from "@/lib/rerank";
import { searchChunks } from "@/lib/retrieval";
import { getCurrentUser } from "@/lib/session";
import {
  formatUntrustedDocuments,
  UNTRUSTED_DOCUMENT_RULES,
} from "@/lib/untrusted-content";

// Give up on reranking after this long and answer with Pinecone's order,
// so a slow reranker can't hold up the chat
const RERANK_TIMEOUT_MS = 8000;

// The system prompt tells Gemini to reply with exactly this when the
// context doesn't contain the answer
const NOT_FOUND_ANSWER =
  "I couldn't find that information in the provided documents.";

type ChatMessage = {
  role: "user" | "ai";
  text: string;
};

export async function POST(request: Request) {
  // Who the caller is comes only from the signed session cookie
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

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

    // Matched on both id and owner, so another user's conversationId looks
    // the same as one that doesn't exist: 404, without revealing it exists.
    // Checked before any retrieval or model call, and before anything is saved.
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, userId: user.userId },
      select: { id: true },
    });

    if (!conversation) {
      return Response.json(
        {
          error: "Conversation not found",
        },
        {
          status: 404,
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

    // --------------------------------
    // 1–3. Search Pinecone for related chunks (also the answer's sources)
    // --------------------------------

    // Optional: only search chunks from one uploaded PDF
    const documentId =
      typeof body.documentId === "string" && body.documentId
        ? body.documentId
        : undefined;

    // Embeds the question, queries Pinecone and drops weak matches
    const candidates = await searchChunks(question, { documentId });

    // --------------------------------
    // 4. Rerank: keep only chunks that help answer the question
    // --------------------------------

    let sources = candidates;

    try {
      const reranked = await Promise.race([
        rerankChunks(question, candidates),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("Reranking timed out")),
            RERANK_TIMEOUT_MS,
          ),
        ),
      ]);

      console.log(
        "Rerank scores:",
        reranked.map(({ id, score }) => `${id}: ${score}`),
      );

      // Most relevant first; drop chunks judged irrelevant (0).
      // A null score (Gemini skipped it) is unknown, so it's kept.
      sources = reranked
        .filter(({ score }) => score !== 0)
        .map(({ id }) => candidates.find((doc) => doc.id === id)!);
    } catch (error) {
      // Answer with Pinecone's order rather than failing the chat
      console.error("Reranking failed, using Pinecone order", error);
    }

    // Label each chunk with where it came from, inside a marked block of
    // untrusted data (see untrusted-content.ts)
    const context = formatUntrustedDocuments(
      sources.map((doc) => ({
        label: `${doc.source}, chunk ${doc.chunkIndex}`,
        text: doc.text,
      })),
    );

    // --------------------------------
    // 5. Build instructions + chat history for Gemini
    // --------------------------------
    const systemInstruction = `
You are a helpful company knowledge assistant.

Answer the user's question using ONLY the provided context.

If the answer cannot be found in the context, say:
"${NOT_FOUND_ANSWER}"

Do not make up company policies or information.

${UNTRUSTED_DOCUMENT_RULES}

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
    // 6. Stream Gemini response
    // --------------------------------

    const stream = await ai.models.generateContentStream({
      model: CHAT_MODEL,
      config: {
        systemInstruction,
      },
      contents,
    });

    // Save the question only once Gemini has accepted the request, so a
    // failed request (e.g. a 503) doesn't leave an unanswered question
    await prisma.message.create({
      data: {
        conversationId,
        role: "user",
        text: question,
      },
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

          // Nothing was answered from these chunks, so don't list them
          // as sources (happens when reranking fell back to Pinecone)
          const usedSources = result.trim().startsWith(NOT_FOUND_ANSWER)
            ? []
            : sources;

          // Sent after the answer so the UI can list them under it
          controller.enqueue(
            encodeEvent({ type: "sources", sources: usedSources }),
          );

          if (result) {
            await prisma.message.create({
              data: {
                conversationId,
                role: "ai",
                text: result,
                sources: usedSources,
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

    // Gemini is overloaded: show a readable message instead of its raw JSON
    if (error instanceof ApiError && error.status === 503) {
      return Response.json(
        {
          error: "The AI model is busy right now. Please try again in a moment.",
        },
        {
          status: 503,
        },
      );
    }

    return Response.json(
      {
        error: "Internal server error",
      },
      {
        status: 500,
      },
    );
  }
}
