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

    // Previous version of this file, if any; kept until the new one is indexed
    const existingDocument = await prisma.document.findFirst({
      where: {
        fileName: file.name,
      },
    });

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

      const embedding = await embedDocument(chunk.text);

      records.push({
        id: `${documentId}-${i}`,
        values: embedding,
        metadata: {
          text: chunk.text,
          source: file.name,
          documentId,
          chunkIndex: i,
          // Pinecone metadata can't hold undefined, so only set it when known
          ...(chunk.section && { section: chunk.section }),
        },
      });
    }

    // -----------------------------
    // 4. Store in Pinecone
    // -----------------------------

    const index = getIndex();

    await index.upsert({
      records,
    });

    // -----------------------------
    // 5. Save document in Postgres
    // -----------------------------

    await prisma.document.create({
      data: {
        id: documentId,
        fileName: file.name,
        chunkCount: chunks.length,
      },
    });

    // -----------------------------
    // 6. Remove the previous version
    // -----------------------------

    // Only once the new version is fully indexed, so a failed
    // re-upload never leaves the file missing
    if (existingDocument) {
      await index.deleteMany({
        filter: {
          documentId: {
            $eq: existingDocument.id,
          },
        },
      });

      await prisma.document.delete({
        where: {
          id: existingDocument.id,
        },
      });
    }

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
