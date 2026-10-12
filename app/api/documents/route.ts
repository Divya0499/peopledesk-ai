import { listDocuments } from "@/lib/ingest";
import { isAdminRole } from "@/lib/roles";
import { getCurrentUser } from "@/lib/session";

// admins also see processing / failed ones
export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const documents = await listDocuments(isAdminRole(user.role));

    return Response.json({ documents });
  } catch (error) {
    console.error(error);

    return Response.json(
      {
        error: "Internal server error",
      },
      { status: 500 },
    );
  }
}
