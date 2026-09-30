import { PDFParse } from "pdf-parse";
import { embedDocument } from "@/lib/gemini";
import { getIndex } from "@/lib/pinecone";
import { chunkText } from "@/lib/chunkText";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    // Returns null if the request isn't multipart/form-data
    const formData = await request.formData().catch(() => null);

    const file = formData?.get("file");

    if (!(file instanceof File)) {
      return Response.json(
        {
          error: "PDF file is required",
        },
        {
          status: 400,
        }
      );
    }

    // Unique ID for this upload, shared by all its chunks
    const documentId = crypto.randomUUID();

    // -----------------------------
    // 1. Read PDF
    // -----------------------------

    const arrayBuffer = await file.arrayBuffer();

    const parser = new PDFParse({
      data: new Uint8Array(arrayBuffer),
    });

    let text: string;

    try {
      const pdfData = await parser.getText();
      // Remove page markers like "-- 1 of 3 --" that pdf-parse adds
      text = pdfData.text.replace(/-- \d+ of \d+ --/g, " ");
    } finally {
      await parser.destroy();
    }

    if (!text.trim()) {
      return Response.json(
        {
          error: "Could not extract text from PDF",
        },
        {
          status: 400,
        }
      );
    }

    // -----------------------------
    // 2. Split into chunks
    // -----------------------------

    const chunks = chunkText(text);

    // -----------------------------
    // 3. Create embeddings
    // -----------------------------

    const records = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      const embedding = await embedDocument(chunk);

      records.push({
        id: `${documentId}-${i}`,
        values: embedding,
        metadata: {
          text: chunk,
          source: file.name,
          documentId,
          chunkIndex: i,
        },
      });
    }

    // -----------------------------
    // 4. Store in Pinecone
    // -----------------------------

    const index = getIndex();

    // Re-uploading a file with the same name replaces it,
    // so remove the previous version's chunks first
    await index.deleteMany({
      filter: {
        source: { $eq: file.name },
      },
    });

    await index.upsert({
      records,
    });

    // -----------------------------
    // 5. Save document in Postgres
    // -----------------------------

    // Same rule as Pinecone: a re-upload replaces the old row
    await prisma.$transaction([
      prisma.document.deleteMany({
        where: { fileName: file.name },
      }),
      prisma.document.create({
        data: {
          id: documentId,
          fileName: file.name,
          chunkCount: chunks.length,
        },
      }),
    ]);

    return Response.json({
      message: "PDF uploaded successfully",
      fileName: file.name,
      documentId,
      chunks: chunks.length,
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
