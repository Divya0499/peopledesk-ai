import type { PineconeRecord } from "@pinecone-database/pinecone";
import { PDFParse } from "pdf-parse";

import { chunkText } from "@/lib/chunkText";
import { checkDocument } from "@/lib/document-check";
import { embedDocument } from "@/lib/gemini";
import { getIndex } from "@/lib/pinecone";
import { prisma } from "@/lib/prisma";

// less than this = probably a scanned pdf
const MIN_TEXT_CHARS = 50;

const EMBED_CONCURRENCY = 4;

const STALE_PROCESSING_MS = 15 * 60 * 1000;

// "rejected" = problem with the file, "failed" = our side, can retry
export class DocumentProcessingError extends Error {
  constructor(
    message: string,
    readonly status: "rejected" | "failed" = "rejected",
  ) {
    super(message);
  }
}

export async function extractPdfText(bytes: Uint8Array) {
  // copy because the parser transfers the buffer to a worker
  const parser = new PDFParse({ data: bytes.slice() });

  try {
    const pdfData = await parser.getText();

    // remove the "-- 1 of 3 --" markers pdf-parse adds
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
            // pinecone doesn't accept undefined
            ...(chunk.section && { section: chunk.section }),
          },
        });
      });
    }

    await getIndex().upsert({ records });
  } catch (error) {
    // clean up so we don't end up with half a document
    await deleteDocumentVectors(documentId).catch(() => {});
    throw error;
  }

  return chunks.length;
}

// process uploads one by one, otherwise we hit the embedding rate limit
let queue: Promise<void> = Promise.resolve();

export function enqueueUpload(
  documentId: string,
  fileName: string,
  bytes: Uint8Array,
) {
  const run = queue.then(() => processUpload(documentId, fileName, bytes));

  queue = run.catch((error) => {
    console.error("Upload processing crashed:", error);
  });

  return run;
}

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

    // it could have been deleted while we were processing
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

// re-upload: remove the old copies only after the new one is ready
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
    await prisma.document.deleteMany({ where: { id: document.id } });
  }
}

export async function listDocuments(includeUnfinished: boolean) {
  // server probably restarted while these were processing
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
