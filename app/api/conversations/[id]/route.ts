import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import {
  deleteSupervisorRun,
  getSupervisorCheckpointer,
} from "@/lib/supervisor-agent";

// Deletes one of the caller's own conversations, with its messages and any
// leave application in it still waiting for approval
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

    // Matched on id and owner, so another user's conversation gets the same
    // 404 as one that doesn't exist and its existence isn't revealed
    const conversation = await prisma.conversation.findFirst({
      where: { id, userId: user.userId },
      select: { id: true, agentThreads: { select: { id: true } } },
    });

    if (!conversation) {
      return Response.json({ error: "Conversation not found" }, { status: 404 });
    }

    // A paused run's saved state isn't in a table Prisma knows about, so it
    // isn't removed with the conversation: delete it first
    if (conversation.agentThreads.length > 0) {
      const checkpointer = await getSupervisorCheckpointer();

      for (const thread of conversation.agentThreads) {
        await deleteSupervisorRun(checkpointer, thread.id);
      }
    }

    // Its messages and AgentThread rows go with it (onDelete: Cascade)
    await prisma.conversation.delete({ where: { id } });

    return Response.json({ message: "Conversation deleted", conversationId: id });
  } catch (error) {
    console.error(error);

    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
