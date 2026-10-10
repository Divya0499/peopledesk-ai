import { listConversations } from "@/lib/conversations";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

// titles only; GET /api/conversations/[id] loads one conversation's messages
export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return Response.json({
      conversations: await listConversations(user.userId),
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

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    const conversation = await prisma.conversation.create({
      data: {
        userId: user.userId,
        title: body.title ?? "New Conversation",
      },
    });

    return Response.json({
      conversation,
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