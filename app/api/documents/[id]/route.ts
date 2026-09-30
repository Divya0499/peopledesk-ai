import { prisma } from "@/lib/prisma";
import { getIndex } from "@/lib/pinecone";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const document = await prisma.document.findUnique({
      where: { id },
    });

    if (!document) {
      return Response.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Remove the vectors first: if this fails, the row stays and the
    // delete can be retried, instead of leaving orphaned vectors behind
    const index = getIndex();

    await index.deleteMany({
      filter: {
        documentId: {
          $eq: id,
        },
      },
    });

    await prisma.document.delete({
      where: { id },
    });

    return Response.json({
      message: "Document deleted successfully",
      documentId: id,
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete document",
      },
      { status: 500 }
    );
  }
}
