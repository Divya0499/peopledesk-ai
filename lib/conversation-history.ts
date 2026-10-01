import { prisma } from "./prisma";
import { toLangChainMessages } from "./langchain-history";

// Loads a conversation's messages, oldest first, as LangChain messages
export async function getConversationHistory(conversationId: string) {
  const messages = await prisma.message.findMany({
    where: {
      conversationId,
    },
    orderBy: {
      createdAt: "asc",
    },
    // Only what the model needs; skips the stored sources
    select: {
      role: true,
      text: true,
    },
  });

  return toLangChainMessages(messages);
}
