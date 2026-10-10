import { redirect } from "next/navigation";

import { getConversation, listConversations } from "@/lib/conversations";
import { listDocuments } from "@/lib/ingest";
import { getCurrentUser } from "@/lib/session";

import ChatLayout from "./_components/ChatLayout";
import type { ConversationDetail } from "./_components/types";

type ChatPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

// Loads everything the first screen needs on the server, in parallel, so the
// page arrives ready instead of fetching again from the browser
async function Chat({ searchParams }: ChatPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const isAdmin = user.role === "admin";
  const { c } = await searchParams;
  const openId = typeof c === "string" ? c : undefined;

  const [conversations, documents, opened] = await Promise.all([
    listConversations(user.userId),
    // admins also see processing / failed ones
    listDocuments(isAdmin),
    openId ? getConversation(user.userId, openId) : null,
  ]);

  // Only hides the admin-only controls; the API routes still check the role
  return (
    <ChatLayout
      isAdmin={isAdmin}
      userName={user.name}
      userRole={user.role}
      initialConversations={conversations}
      initialDocuments={documents}
      // sources are stored as JSON
      initialConversation={opened as ConversationDetail | null}
    />
  );
}

export default Chat;
