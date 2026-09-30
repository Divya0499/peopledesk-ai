import { pinecone } from "@/lib/pinecone";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const index = pinecone.index(process.env.PINECONE_INDEX!);

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
        error:
          error instanceof Error
            ? error.message
            : "Something went wrong",
      },
      { status: 500 }
    );
  }
}