import "server-only";

import type { ApprovalEvent } from "@/lib/agent-stream-events";
import { prisma } from "@/lib/prisma";
import { getPendingApproval } from "@/lib/supervisor-agent";

// The sidebar only needs titles. Messages are loaded per conversation when it
// is opened, so a long history doesn't slow down every page load.
export function listConversations(userId: string) {
  return prisma.conversation.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true },
  });
}

// One conversation with its messages and, if a leave request in it is still
// waiting for the employee, that approval, so the card shows again after a
// reload. null if it doesn't exist or isn't this user's.
export async function getConversation(userId: string, conversationId: string) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, userId },
    select: {
      id: true,
      title: true,
      messages: {
        orderBy: { createdAt: "asc" },
        select: { role: true, text: true, sources: true },
      },
      agentThreads: { select: { id: true } },
    },
  });

  if (!conversation) {
    return null;
  }

  // checked together; a thread with nothing pending is finished, so drop it
  const approvals = await Promise.all(
    conversation.agentThreads.map(async (thread) => {
      const approval = await getPendingApproval(userId, thread.id);

      if (!approval) {
        await prisma.agentThread.deleteMany({ where: { id: thread.id } });
      }

      return approval;
    }),
  );

  const pendingApproval: ApprovalEvent | null =
    approvals.find((approval) => approval !== undefined) ?? null;

  return {
    id: conversation.id,
    title: conversation.title,
    messages: conversation.messages,
    pendingApproval,
  };
}

export type ConversationListItem = Awaited<
  ReturnType<typeof listConversations>
>[number];
export type ConversationDetail = NonNullable<
  Awaited<ReturnType<typeof getConversation>>
>;
