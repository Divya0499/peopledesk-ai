import { readFile } from "node:fs/promises";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/session";

import { describeDb, PASSWORD, resetDatabase, seedTeam } from "../support/db";

// mock the session, everything else is real
const session = vi.hoisted(() => ({
  user: null as CurrentUser | null,
  createSession: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  getCurrentUser: async () => session.user,
  createSession: session.createSession,
  requireAdmin: async () => {
    if (!session.user) {
      return {
        error: Response.json({ error: "Unauthorized" }, { status: 401 }),
      };
    }

    if (session.user.role !== "admin") {
      return { error: Response.json({ error: "Forbidden" }, { status: 403 }) };
    }

    return { user: session.user };
  },
}));

// Processing runs after the response (see ingest.test.ts); here the route
// only has to accept the file and queue it
const ingest = vi.hoisted(() => ({ enqueueUpload: vi.fn() }));
vi.mock("@/lib/ingest", () => ingest);

// after() needs a real Next.js request; run its callback straight away
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (callback: () => unknown) => callback(),
}));

const { POST: login } = await import("@/app/api/auth/login/route");
const { POST: upload } = await import("@/app/api/upload/route");
const leaveRoute = await import("@/app/api/leave/route");
const employeesRoute = await import("@/app/api/employees/route");

const as = (id: string, role: "employee" | "admin" = "employee") => {
  session.user = { userId: id, name: id, email: `${id}@test.dev`, role };
};

function json(url: string, body: unknown, headers: HeadersInit = {}) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

async function uploadRequest(file: Blob, name: string) {
  const form = new FormData();
  form.append("file", file, name);

  return new Request("http://test/api/upload", { method: "POST", body: form });
}

const fixture = async (path: string) =>
  new Blob([await readFile(`tests/fixtures/pdfs/${path}`)], {
    type: "application/pdf",
  });

describeDb("API routes", () => {
  beforeEach(async () => {
    session.user = null;
    session.createSession.mockReset();
    ingest.enqueueUpload.mockReset();
    await resetDatabase();
    await seedTeam();
  });

  describe("POST /api/auth/login", () => {
    const attempt = (email: string, password: string, ip: string) =>
      login(
        json(
          "http://test/api/auth/login",
          { email, password },
          {
            "x-forwarded-for": ip,
          },
        ),
      );

    it("logs in with the right password, whatever the email's case", async () => {
      const response = await attempt(" ALICE@test.dev ", PASSWORD, "1.1.1.1");

      expect(response.status).toBe(200);
      expect(session.createSession).toHaveBeenCalledWith("alice");
    });

    it("gives the same answer for a wrong password and an unknown email", async () => {
      const wrong = await attempt("alice@test.dev", "nope", "1.1.1.2");
      const unknown = await attempt("ghost@test.dev", PASSWORD, "1.1.1.2");

      expect(wrong.status).toBe(401);
      expect(unknown.status).toBe(401);
      expect(await wrong.json()).toEqual(await unknown.json());
      expect(session.createSession).not.toHaveBeenCalled();
    });

    it("blocks an account after 5 failed attempts, even with the right password", async () => {
      for (let i = 0; i < 5; i++) {
        await attempt("bob@test.dev", "wrong", "1.1.1.3");
      }

      const response = await attempt("bob@test.dev", PASSWORD, "1.1.1.3");

      expect(response.status).toBe(429);
      expect(response.headers.get("retry-after")).toBeTruthy();
    });

    it("requires both fields", async () => {
      expect((await attempt("", PASSWORD, "1.1.1.4")).status).toBe(400);
      expect((await attempt("alice@test.dev", "", "1.1.1.4")).status).toBe(400);
    });
  });

  describe("POST /api/upload", () => {
    it("is admin-only", async () => {
      const file = await fixture("should-upload/nimbus-employee-handbook.pdf");

      expect((await upload(await uploadRequest(file, "a.pdf"))).status).toBe(
        401,
      );

      as("alice");
      expect((await upload(await uploadRequest(file, "a.pdf"))).status).toBe(
        403,
      );
    });

    it("refuses files that aren't PDFs, by name and by content", async () => {
      as("admin", "admin");

      const docx = await upload(
        await uploadRequest(
          await fixture("should-reject/word-file.docx"),
          "word-file.docx",
        ),
      );
      expect(docx.status).toBe(400);

      const image = await upload(
        await uploadRequest(
          await fixture("should-reject/image-renamed-to-pdf.pdf"),
          "image.pdf",
        ),
      );
      expect(image.status).toBe(400);
      expect((await image.json()).error).toBe("This file isn't a valid PDF");
    });

    it("refuses files over 10 MB before reading them", async () => {
      as("admin", "admin");
      const big = new Blob(["%PDF-1.4\n", new Uint8Array(11 * 1024 * 1024)]);

      const response = await upload(await uploadRequest(big, "big.pdf"));

      expect(response.status).toBe(413);
      expect(ingest.enqueueUpload).not.toHaveBeenCalled();
    });

    it("accepts a PDF as processing and queues it", async () => {
      as("admin", "admin");

      const response = await upload(
        await uploadRequest(
          await fixture("should-upload/nimbus-employee-handbook.pdf"),
          "handbook.pdf",
        ),
      );

      expect(response.status).toBe(202);
      const body = await response.json();
      expect(body).toMatchObject({
        fileName: "handbook.pdf",
        status: "processing",
      });

      const saved = await prisma.document.findUniqueOrThrow({
        where: { id: body.documentId },
      });
      expect(saved).toMatchObject({
        status: "processing",
        uploadedById: "admin",
      });
      expect(ingest.enqueueUpload).toHaveBeenCalledWith(
        body.documentId,
        "handbook.pdf",
        expect.any(Uint8Array),
      );
    });
  });

  describe("POST /api/leave", () => {
    const requestLeave = (body: unknown, key?: string) =>
      leaveRoute.POST(
        json(
          "http://test/api/leave",
          body,
          key ? { "Idempotency-Key": key } : {},
        ),
      );

    it("needs a session and an idempotency key", async () => {
      expect((await requestLeave({ days: 1 }, "k")).status).toBe(401);

      as("alice");
      expect((await requestLeave({ days: 1 })).status).toBe(400);
    });

    it("validates the days", async () => {
      as("alice");

      for (const days of [0, 61, 1.5, "2"]) {
        expect((await requestLeave({ days }, `k-${days}`)).status).toBe(400);
      }
    });

    it("creates a pending request, once per key", async () => {
      as("alice");

      expect((await requestLeave({ days: 2 }, "same")).status).toBe(201);
      expect((await requestLeave({ days: 2 }, "same")).status).toBe(201);

      const data = await (await leaveRoute.GET()).json();
      expect(data.leaveBalance).toBe(8);
      expect(data.mine).toHaveLength(1);
      expect(data.teamPending).toBeNull();
    });

    it("keeps two users' keys apart", async () => {
      as("alice");
      await requestLeave({ days: 1 }, "shared");
      as("bob");
      await requestLeave({ days: 1 }, "shared");

      const data = await (await leaveRoute.GET()).json();
      expect(data.mine).toHaveLength(1);
    });

    it("explains a request that's over the balance", async () => {
      as("alice");
      const response = await requestLeave({ days: 20 }, "big");

      expect(response.status).toBe(409);
      expect((await response.json()).error).toBe("Insufficient leave balance");
    });
  });

  describe("/api/employees", () => {
    it("is admin-only", async () => {
      expect((await employeesRoute.GET()).status).toBe(401);

      as("manager");
      expect((await employeesRoute.GET()).status).toBe(403);
      expect(
        (
          await employeesRoute.POST(
            json("http://test/api/employees", { name: "X" }),
          )
        ).status,
      ).toBe(403);
    });

    it("returns the first validation problem", async () => {
      as("admin", "admin");

      const response = await employeesRoute.POST(
        json("http://test/api/employees", {
          name: "X",
          email: "bad",
          department: "E",
          role: "employee",
          leaveBalance: 1,
          password: "Welcome@123",
        }),
      );

      expect(response.status).toBe(400);
      expect((await response.json()).error).toBe("Enter a valid email address");
    });
  });
});
