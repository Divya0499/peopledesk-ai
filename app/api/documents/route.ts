import { getIndex } from "@/lib/pinecone";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

// Any logged-in user may see which documents the knowledge base holds; only
// admins may change them (upload and DELETE /api/documents/[id]).
export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const index = getIndex();

    const [stats, documents] = await Promise.all([
      index.describeIndexStats(),
      prisma.document.findMany({
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return Response.json({
      message: "Documents API",
      stats,
      documents,
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      {
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}