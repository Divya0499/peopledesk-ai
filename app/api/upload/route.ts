import { after } from "next/server";

import { enqueueUpload } from "@/lib/ingest";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

// after() still counts against this
export const maxDuration = 300;

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_FILE_LABEL = "10 MB";
// extra room for the multipart headers
const MAX_REQUEST_BYTES = MAX_FILE_BYTES + 64 * 1024;

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // check before reading the body. header can lie, so file.size is checked again below
  const contentLength = Number(request.headers.get("content-length"));

  if (contentLength > MAX_REQUEST_BYTES) {
    return Response.json(
      { error: `PDF is too large. The limit is ${MAX_FILE_LABEL}.` },
      { status: 413 },
    );
  }

  try {
    const formData = await request.formData().catch(() => null);

    const file = formData?.get("file");

    if (!(file instanceof File)) {
      return Response.json(
        {
          error: "PDF file is required",
        },
        {
          status: 400,
        },
      );
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return Response.json(
        { error: "Only PDF files can be uploaded" },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_BYTES) {
      return Response.json(
        { error: `PDF is too large. The limit is ${MAX_FILE_LABEL}.` },
        { status: 413 },
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());

    // catches renamed word files / images
    if (new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-") {
      return Response.json(
        { error: "This file isn't a valid PDF" },
        { status: 400 },
      );
    }

    const document = await prisma.document.create({
      data: { fileName: file.name, uploadedById: user.userId },
      select: {
        id: true,
        fileName: true,
        chunkCount: true,
        status: true,
        error: true,
      },
    });

    // the slow part (parsing, checking, embedding) runs after we respond
    after(() => enqueueUpload(document.id, file.name, bytes));

    return Response.json(
      {
        documentId: document.id,
        fileName: document.fileName,
        status: document.status,
        // the full row, so the page can list it without fetching again
        document,
      },
      { status: 202 },
    );
  } catch (error) {
    console.error(error);

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
