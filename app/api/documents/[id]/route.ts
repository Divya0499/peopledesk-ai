import { prisma } from "@/lib/prisma";
import { getIndex } from "@/lib/pinecone";
import { getCurrentUser } from "@/lib/session";

// Removes a document from the shared knowledge base every user's RAG answers
// come from, so only admins may do it. Checked before the document is looked
// up, so a non-admin can't even learn whether an id exists.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Who the caller is and their role come only from the session; the role is
  // read from the database on each request, not from the cookie
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
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
