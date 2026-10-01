import { embedDocument } from "@/lib/gemini";
import { getIndex } from "@/lib/pinecone";
import { getCurrentUser } from "@/lib/session";

// Writes into the shared Pinecone index that every user's RAG answers come
// from, so only admins may run it. Checked before any embedding or upsert.
export async function POST() {
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
    const documents = [
      "Employees receive 20 days of annual leave each year.",
      "Employees must submit leave requests through the HR portal.",
      "Travel expenses must be submitted within 30 days.",
      "Managers approve expense reports through the finance system.",
    ];

    const index = getIndex();

    for (let i = 0; i < documents.length; i++) {
      const text = documents[i];

      const embedding = await embedDocument(text);

      await index.upsert({
        records: [
          {
            id: `document-${i}`,
            values: embedding,
            metadata: {
              text,
            },
          },
        ],
      });
    }

    return Response.json({
      message: "Documents added successfully",
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      {
        error: "Internal server error",
      },
      {
        status: 500,
      }
    );
  }
}