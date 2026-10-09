import { prisma } from "@/lib/prisma";
import { deleteDocumentVectors } from "@/lib/ingest";
import { getCurrentUser } from "@/lib/session";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

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

    // vectors first, so if that fails the row is still there to retry
    if (document.status !== "processing") {
      await deleteDocumentVectors(id);
    }

    await prisma.document.deleteMany({
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
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
