import { after } from "next/server";

import { enqueueUpload } from "@/lib/ingest";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

// Processing runs after the response (after()) but still counts against
// this limit, and embedding a long PDF takes a while
export const maxDuration = 300;

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_FILE_LABEL = "10 MB";
// Room for the multipart boundaries and headers around the file
const MAX_REQUEST_BYTES = MAX_FILE_BYTES + 64 * 1024;

// Uploaded documents feed every user's RAG answers, so only admins may add
// or replace them. Checked before the file is read, so a rejected caller
// costs no parsing or embedding.
// Fast checks (size, type) answer straight away; the slow work runs after
// the response, so the admin isn't left waiting on embedding.
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
      { status: 413 },
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

    // A real PDF starts with "%PDF-", whatever the file is called; this
    // catches a renamed Word file or image before anything else runs
    if (new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-") {
      return Response.json(
        { error: "This file isn't a valid PDF" },
        { status: 400 },
      );
    }

    // Recorded as processing and handed back straight away; reading,
    // checking and embedding run after the response (lib/ingest.ts), and
    // the documents list shows how it ended
    const document = await prisma.document.create({
      data: { fileName: file.name, uploadedById: user.userId },
      select: { id: true, fileName: true, status: true },
    });

    after(() => enqueueUpload(document.id, file.name, bytes));

    return Response.json(
      {
        documentId: document.id,
        fileName: document.fileName,
        status: document.status,
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
