import { readFile } from "node:fs/promises";

import { beforeEach, expect, it, vi } from "vitest";

import { prisma } from "@/lib/prisma";

import { describeDb, resetDatabase, seedTeam } from "../support/db";

// Pinecone and Gemini replaced by in-memory fakes, so processing runs end to
// end (parse, check, chunk, embed, store, status) without network calls
const fakes = vi.hoisted(() => {
  const vectors = new Map<string, { documentId: string; source: string }>();

  return {
    vectors,
    checkDocument: vi.fn(),
    embedDocument: vi.fn(async () => [0.1, 0.2, 0.3]),
    index: {
      upsert: vi.fn(
        async ({
          records,
        }: {
          records: {
            id: string;
            metadata: { documentId: string; source: string };
          }[];
        }) => {
          for (const record of records) {
            vectors.set(record.id, record.metadata);
          }
        },
      ),
      deleteMany: vi.fn(
        async ({ filter }: { filter: { documentId: { $eq: string } } }) => {
          for (const [id, metadata] of vectors) {
            if (metadata.documentId === filter.documentId.$eq) {
              vectors.delete(id);
            }
          }
        },
      ),
    },
  };
});

vi.mock("@/lib/document-check", () => ({
  checkDocument: fakes.checkDocument,
}));
vi.mock("@/lib/gemini", () => ({ embedDocument: fakes.embedDocument }));
vi.mock("@/lib/pinecone", () => ({ getIndex: () => fakes.index }));

const { enqueueUpload, listDocuments, processUpload } =
  await import("@/lib/ingest");

const pdf = async (path: string) =>
  new Uint8Array(await readFile(`tests/fixtures/pdfs/${path}`));

const HANDBOOK = "should-upload/nimbus-employee-handbook.pdf";

async function newDocument(fileName: string) {
  return prisma.document.create({
    data: { fileName, uploadedById: "admin" },
  });
}

const statusOf = (id: string) =>
  prisma.document.findUniqueOrThrow({ where: { id } });

const vectorsOf = (documentId: string) =>
  [...fakes.vectors.values()].filter((v) => v.documentId === documentId);

describeDb("document processing", () => {
  beforeEach(async () => {
    fakes.vectors.clear();
    fakes.checkDocument.mockReset();
    fakes.checkDocument.mockResolvedValue({
      allowed: true,
      documentType: "employee handbook",
      reason: "",
    });
    fakes.embedDocument.mockReset();
    fakes.embedDocument.mockResolvedValue([0.1, 0.2, 0.3]);
    await resetDatabase();
    await seedTeam();
  });

  it("indexes an HR document and marks it ready", async () => {
    const document = await newDocument("handbook.pdf");

    await processUpload(document.id, "handbook.pdf", await pdf(HANDBOOK));

    const saved = await statusOf(document.id);
    expect(saved.status).toBe("ready");
    expect(saved.chunkCount).toBeGreaterThan(0);
    expect(vectorsOf(document.id)).toHaveLength(saved.chunkCount);
    expect(vectorsOf(document.id)[0].source).toBe("handbook.pdf");
  });

  it("rejects a document the content check refuses, storing nothing", async () => {
    fakes.checkDocument.mockResolvedValue({
      allowed: false,
      documentType: "quotation",
      reason: "A supplier's price quote.",
    });
    const document = await newDocument("q.pdf");

    await processUpload(
      document.id,
      "q.pdf",
      await pdf("should-reject/quotation.pdf"),
    );

    const saved = await statusOf(document.id);
    expect(saved.status).toBe("rejected");
    expect(saved.error).toMatch(/looks like: quotation/);
    expect(fakes.embedDocument).not.toHaveBeenCalled();
    expect(fakes.vectors.size).toBe(0);
  });

  it("rejects a scanned PDF without asking the model", async () => {
    const document = await newDocument("scan.pdf");

    await processUpload(
      document.id,
      "scan.pdf",
      await pdf("should-reject/scanned.pdf"),
    );

    expect((await statusOf(document.id)).error).toMatch(/looks like a scan/);
    expect(fakes.checkDocument).not.toHaveBeenCalled();
  });

  it("rejects a damaged PDF", async () => {
    const document = await newDocument("broken.pdf");

    await processUpload(
      document.id,
      "broken.pdf",
      new TextEncoder().encode("%PDF-1.4 this is not really a pdf"),
    );

    expect(await statusOf(document.id)).toMatchObject({
      status: "rejected",
      error: "This file isn't a valid PDF",
    });
  });

  it("fails safe when the content check can't run", async () => {
    fakes.checkDocument.mockRejectedValue(new Error("rate limited"));
    const document = await newDocument("handbook.pdf");

    await processUpload(document.id, "handbook.pdf", await pdf(HANDBOOK));

    const saved = await statusOf(document.id);
    expect(saved.status).toBe("failed");
    expect(saved.error).toMatch(/Couldn't check this document/);
    expect(fakes.vectors.size).toBe(0);
  });

  it("removes stored chunks when embedding fails part-way", async () => {
    let calls = 0;
    fakes.embedDocument.mockImplementation(async () => {
      calls += 1;
      if (calls > 2) throw new Error("embedding API down");
      return [0.1, 0.2, 0.3];
    });
    const document = await newDocument("handbook.pdf");

    await processUpload(document.id, "handbook.pdf", await pdf(HANDBOOK));

    const saved = await statusOf(document.id);
    expect(saved.status).toBe("failed");
    // The internal error isn't shown to the admin
    expect(saved.error).not.toMatch(/embedding API down/);
    expect(vectorsOf(document.id)).toHaveLength(0);
  });

  it("replaces the older copy of a re-uploaded file once the new one is ready", async () => {
    const first = await newDocument("handbook.pdf");
    await processUpload(first.id, "handbook.pdf", await pdf(HANDBOOK));

    const second = await newDocument("handbook.pdf");
    await processUpload(second.id, "handbook.pdf", await pdf(HANDBOOK));

    expect(await prisma.document.count()).toBe(1);
    expect((await statusOf(second.id)).status).toBe("ready");
    expect(vectorsOf(first.id)).toHaveLength(0);
    expect(vectorsOf(second.id).length).toBeGreaterThan(0);
  });

  it("keeps the older copy when the re-upload fails", async () => {
    const first = await newDocument("handbook.pdf");
    await processUpload(first.id, "handbook.pdf", await pdf(HANDBOOK));

    fakes.checkDocument.mockRejectedValue(new Error("rate limited"));
    const second = await newDocument("handbook.pdf");
    await processUpload(second.id, "handbook.pdf", await pdf(HANDBOOK));

    expect((await statusOf(first.id)).status).toBe("ready");
    expect(vectorsOf(first.id).length).toBeGreaterThan(0);
  });

  it("cleans up if the document is deleted while it's processing", async () => {
    const document = await newDocument("handbook.pdf");
    fakes.checkDocument.mockImplementation(async () => {
      // The admin deletes it during the check
      await prisma.document.delete({ where: { id: document.id } });
      return { allowed: true, documentType: "handbook", reason: "" };
    });

    await processUpload(document.id, "handbook.pdf", await pdf(HANDBOOK));

    expect(fakes.vectors.size).toBe(0);
    expect(await prisma.document.count()).toBe(0);
  });

  it("processes queued uploads one at a time, and keeps going after a crash", async () => {
    const order: string[] = [];
    fakes.checkDocument.mockImplementation(async (fileName: string) => {
      order.push(`start ${fileName}`);
      await new Promise((resolve) => setTimeout(resolve, 20));
      order.push(`end ${fileName}`);
      return { allowed: true, documentType: "handbook", reason: "" };
    });
    const a = await newDocument("a.pdf");
    const b = await newDocument("b.pdf");
    const bytes = await pdf(HANDBOOK);

    await Promise.all([
      enqueueUpload(a.id, "a.pdf", bytes),
      enqueueUpload(b.id, "b.pdf", bytes),
    ]);

    expect(order).toEqual([
      "start a.pdf",
      "end a.pdf",
      "start b.pdf",
      "end b.pdf",
    ]);
  });

  it("hides unfinished uploads from employees and marks stuck ones failed", async () => {
    const ready = await newDocument("ready.pdf");
    await processUpload(ready.id, "ready.pdf", await pdf(HANDBOOK));
    await newDocument("pending.pdf");
    const stuck = await newDocument("stuck.pdf");
    // Through Prisma, which stores times in UTC like the app does
    await prisma.document.update({
      where: { id: stuck.id },
      data: { updatedAt: new Date(Date.now() - 60 * 60 * 1000) },
    });

    const forEmployees = await listDocuments(false);
    expect(forEmployees.map((d) => d.fileName)).toEqual(["ready.pdf"]);

    const forAdmins = await listDocuments(true);
    expect(forAdmins).toHaveLength(3);
    expect(forAdmins.find((d) => d.id === stuck.id)?.status).toBe("failed");
  });
});
