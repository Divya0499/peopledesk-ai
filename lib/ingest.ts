import type { PineconeRecord } from "@pinecone-database/pinecone";
import { PDFParse } from "pdf-parse";

import { chunkText } from "@/lib/chunkText";
import { checkDocument } from "@/lib/document-check";
import { embedDocument } from "@/lib/gemini";
import { getIndex } from "@/lib/pinecone";
import { prisma } from "@/lib/prisma";

// Turning an uploaded PDF into searchable chunks: read its text, check it's
// an HR document, split it, embed each chunk and store the vectors in
// Pinecone. The upload route accepts the file and runs processUpload() after
// responding, so the admin doesn't wait for embedding.

// Less text than this is page numbers or stray marks, not real content: the
// PDF is almost certainly scanned images
const MIN_TEXT_CHARS = 50;

// Chunks embedded at once: faster than one at a time, without a burst big
// enough to hit the embedding API's rate limit
const EMBED_CONCURRENCY = 4;

// A document still "processing" after this long was interrupted (the server
// restarted mid-way), so it's reported as failed rather than left spinning
const STALE_PROCESSING_MS = 15 * 60 * 1000;

// A processing problem with a message written for the admin. "rejected"
// means the file itself is the problem (they can fix it); "failed" means
// something on our side went wrong (uploading again may work).
export class DocumentProcessingError extends Error {
  constructor(
    message: string,
    readonly status: "rejected" | "failed" = "rejected",
  ) {
    super(message);
  }
}

export async function extractPdfText(bytes: Uint8Array) {
  // A copy: the parser hands its buffer to a worker, which leaves the
  // original unusable for anyone else
  const parser = new PDFParse({ data: bytes.slice() });

  try {
    const pdfData = await parser.getText();

    // Remove page markers like "-- 1 of 3 --" that pdf-parse adds
    return pdfData.text.replace(/-- \d+ of \d+ --/g, " ");
  } catch (error) {
    console.error(error);
    throw new DocumentProcessingError("This file isn't a valid PDF");
  } finally {
    await parser.destroy();
  }
}

export function hasReadableText(text: string) {
  return text.replace(/\s/g, "").length >= MIN_TEXT_CHARS;
}

export async function deleteDocumentVectors(documentId: string) {
  await getIndex().deleteMany({
    filter: { documentId: { $eq: documentId } },
  });
}

// Splits, embeds and stores the text; returns the number of chunks. If any
// step fails, the chunks already stored are removed again, so a document is
// never half-searchable.
export async function indexDocument(
  documentId: string,
  fileName: string,
  text: string,
) {
  const chunks = chunkText(text);
  const records: PineconeRecord[] = [];

  try {
    for (let start = 0; start < chunks.length; start += EMBED_CONCURRENCY) {
      const batch = chunks.slice(start, start + EMBED_CONCURRENCY);
      const embeddings = await Promise.all(
        batch.map((chunk) => embedDocument(chunk.text)),
      );

      batch.forEach((chunk, offset) => {
        const chunkIndex = start + offset;

        records.push({
          id: `${documentId}-${chunkIndex}`,
          values: embeddings[offset],
          metadata: {
            text: chunk.text,
            source: fileName,
            documentId,
            chunkIndex,
            // Pinecone metadata can't hold undefined, so only set it when known
            ...(chunk.section && { section: chunk.section }),
          },
        });
      });
    }

    await getIndex().upsert({ records });
  } catch (error) {
    await deleteDocumentVectors(documentId).catch(() => {});
    throw error;
  }

  return chunks.length;
}

// Uploads waiting to be processed, one after another: several files
// uploaded together would otherwise all embed at once and hit the embedding
// API's rate limit. Per server process; each serverless instance has its own.
let queue: Promise<void> = Promise.resolve();

// Processes the upload once the ones before it are done
export function enqueueUpload(
  documentId: string,
  fileName: string,
  bytes: Uint8Array,
) {
  const run = queue.then(() => processUpload(documentId, fileName, bytes));

  // If one ever throws (say the database is down), the next still runs
  queue = run.catch((error) => {
    console.error("Upload processing crashed:", error);
  });

  return run;
}

// Everything after the upload response. Never throws: the outcome is saved
// on the document for the admin to see.
export async function processUpload(
  documentId: string,
  fileName: string,
  bytes: Uint8Array,
) {
  try {
    const text = await extractPdfText(bytes);

    if (!hasReadableText(text)) {
      throw new DocumentProcessingError(
        "This PDF has no readable text. It looks like a scan; upload a PDF whose text can be selected.",
      );
    }

    let check;

    try {
      check = await checkDocument(fileName, text);
    } catch (error) {
      // Never let an unchecked file through
      console.error("Document check failed:", error);
      throw new DocumentProcessingError(
        "Couldn't check this document right now. Please upload it again in a minute.",
        "failed",
      );
    }

    if (!check.allowed) {
      throw new DocumentProcessingError(
        `Not an HR document (looks like: ${check.documentType}). ${check.reason}`,
      );
    }

    const chunkCount = await indexDocument(documentId, fileName, text);

    // Only if it's still processing: an admin may have deleted it meanwhile,
    // and then its new vectors must go too
    const marked = await prisma.document.updateMany({
      where: { id: documentId, status: "processing" },
      data: { status: "ready", chunkCount, error: null },
    });

    if (marked.count === 0) {
      await deleteDocumentVectors(documentId);
      return;
    }

    await removeOlderVersions(documentId, fileName);
  } catch (error) {
    console.error(`Processing ${fileName} failed:`, error);

    // A system error's details stay in the log; the admin gets a message
    // only when it's one written for them
    const known = error instanceof DocumentProcessingError ? error : null;

    await prisma.document.updateMany({
      where: { id: documentId, status: "processing" },
      data: {
        status: known?.status ?? "failed",
        error:
          known?.message ??
          "Something went wrong while processing this PDF. Please upload it again.",
      },
    });
  }
}

// Once a re-uploaded file is ready, the copies of it (same name) uploaded
// before it are removed. Only then, so a failed re-upload never leaves the
// file missing; and only older ones, so a newer upload still processing
// isn't removed from under it.
async function removeOlderVersions(documentId: string, fileName: string) {
  const current = await prisma.document.findUniqueOrThrow({
    where: { id: documentId },
    select: { createdAt: true },
  });
  const older = await prisma.document.findMany({
    where: {
      fileName,
      id: { not: documentId },
      createdAt: { lte: current.createdAt },
    },
    select: { id: true },
  });

  for (const document of older) {
    await deleteDocumentVectors(document.id);
    // deleteMany: an admin may have deleted it already
    await prisma.document.deleteMany({ where: { id: document.id } });
  }
}

// The documents list. Anyone may see what's searchable; only admins see
// uploads that are still processing or didn't make it.
export async function listDocuments(includeUnfinished: boolean) {
  await prisma.document.updateMany({
    where: {
      status: "processing",
      updatedAt: { lt: new Date(Date.now() - STALE_PROCESSING_MS) },
    },
    data: {
      status: "failed",
      error: "Processing didn't finish. Please upload the PDF again.",
    },
  });

  return prisma.document.findMany({
    where: includeUnfinished ? {} : { status: "ready" },
    select: {
      id: true,
      fileName: true,
      chunkCount: true,
      status: true,
      error: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
}
