import { embedDocument } from "@/lib/gemini";
import { getIndex } from "@/lib/pinecone";

export async function POST() {
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
        error:
          error instanceof Error
            ? error.message
            : "Something went wrong",
      },
      {
        status: 500,
      }
    );
  }
}