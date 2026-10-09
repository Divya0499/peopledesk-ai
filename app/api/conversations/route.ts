import type { ApprovalEvent } from "@/lib/agent-stream-events";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getPendingApproval } from "@/lib/supervisor-agent";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const conversations = await prisma.conversation.findMany({
      where: {
        userId: user.userId,
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        messages: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    // so the approve/reject card shows again after a reload
    const pendingByConversation = new Map<string, ApprovalEvent>();

    const threads = await prisma.agentThread.findMany({
      where: { userId: user.userId, conversationId: { not: null } },
      select: { id: true, conversationId: true },
    });

    for (const thread of threads) {
      const approval = await getPendingApproval(user.userId, thread.id);

      if (approval && thread.conversationId) {
        pendingByConversation.set(thread.conversationId, approval);
      } else {
        await prisma.agentThread.deleteMany({ where: { id: thread.id } });
      }
    }

    return Response.json({
      conversations: conversations.map((conversation) => ({
        ...conversation,
        pendingApproval: pendingByConversation.get(conversation.id) ?? null,
      })),
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