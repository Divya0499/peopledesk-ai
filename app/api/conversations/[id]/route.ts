import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import {
  deleteSupervisorRun,
  getSupervisorCheckpointer,
} from "@/lib/supervisor-agent";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;

    const conversation = await prisma.conversation.findFirst({
      where: { id, userId: user.userId },
      select: { id: true, agentThreads: { select: { id: true } } },
    });

    if (!conversation) {
      return Response.json({ error: "Conversation not found" }, { status: 404 });
    }

    // checkpoints aren't prisma tables so they don't cascade
    if (conversation.agentThreads.length > 0) {
      const checkpointer = await getSupervisorCheckpointer();

      for (const thread of conversation.agentThreads) {
        await deleteSupervisorRun(checkpointer, thread.id);
      }
    }

    await prisma.conversation.delete({ where: { id } });

    return Response.json({ message: "Conversation deleted", conversationId: id });
  } catch (error) {
    console.error(error);

    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
