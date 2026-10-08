import { PDFParse } from "pdf-parse";
import { embedDocument } from "@/lib/gemini";
import { getIndex } from "@/lib/pinecone";
import { chunkText } from "@/lib/chunkText";
import { checkDocument } from "@/lib/document-check";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_FILE_LABEL = "10 MB";
// Room for the multipart boundaries and headers around the file
const MAX_REQUEST_BYTES = MAX_FILE_BYTES + 64 * 1024;
// Less text than this is page numbers or stray marks, not real content: the
// PDF is almost certainly scanned images
const MIN_TEXT_CHARS = 50;

// Uploaded documents feed every user's RAG answers, so only admins may add
// or replace them. Checked before the file is read, so a rejected caller
// costs no parsing or embedding.
export async function POST(request: Request) {
  // Who the caller is and their role come only from the session; the role is
  // read from the database on each request, not from the cookie
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // Checked before the body is read, so an oversized upload is turned away
  // without being loaded into memory. The header can be missing or wrong,
  // so the file's own size is checked again below.
  const contentLength = Number(request.headers.get("content-length"));

  if (contentLength > MAX_REQUEST_BYTES) {
    return Response.json(
      { error: `PDF is too large. The limit is ${MAX_FILE_LABEL}.` },
      { status: 413 }
    );
  }

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

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return Response.json(
        { error: "Only PDF files can be uploaded" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_BYTES) {
      return Response.json(
        { error: `PDF is too large. The limit is ${MAX_FILE_LABEL}.` },
        { status: 413 }
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

    // A real PDF starts with "%PDF-", whatever the file is called; this
    // catches a renamed Word file or image before the parser sees it
    const header = new TextDecoder().decode(arrayBuffer.slice(0, 5));

    if (header !== "%PDF-") {
      return Response.json(
        { error: "This file isn't a valid PDF" },
        { status: 400 }
      );
    }

    const parser = new PDFParse({
      data: new Uint8Array(arrayBuffer),
    });

    let text: string;

    try {
      const pdfData = await parser.getText();
      // Remove page markers like "-- 1 of 3 --" that pdf-parse adds
      text = pdfData.text.replace(/-- \d+ of \d+ --/g, " ");
    } catch (error) {
      // A damaged file, or not a PDF at all: the uploader's problem, not
      // the server's, so say so instead of a 500
      console.error(error);

      return Response.json(
        {
          error: "This file isn't a valid PDF",
        },
        {
          status: 400,
        }
      );
    } finally {
      await parser.destroy();
    }

    if (text.replace(/\s/g, "").length < MIN_TEXT_CHARS) {
      return Response.json(
        {
          error:
            "This PDF has no readable text. It looks like a scan; upload a PDF whose text can be selected.",
        },
        {
          status: 400,
        }
      );
    }

    // -----------------------------
    // 1b. Check it's an HR document
    // -----------------------------

    // Before chunking and embedding, so a rejected file costs one model call
    let check;

    try {
      check = await checkDocument(file.name, text);
    } catch (error) {
      // Never let an unchecked file through
      console.error("Document check failed:", error);

      return Response.json(
        {
          error:
            "Couldn't check this document right now. Please try again in a minute.",
        },
        { status: 503 }
      );
    }

    if (!check.allowed) {
      return Response.json(
        {
          error: `Not an HR document (looks like: ${check.documentType}). ${check.reason}`,
        },
        { status: 422 }
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
      // A file with the same name was replaced by this upload
      replaced: Boolean(existingDocument),
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      {
        error: "Internal server error",
      },
      {
        status: 500,
      }
    );
  }
}
