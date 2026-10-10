"use client";
import { useEffect, useState } from "react";
import NavLinks from "@/app/_components/NavLinks";
import UserCard from "@/app/_components/UserCard";
import { withPendingApproval } from "./approval";
import ChatWindow from "./ChatWindow";
import ConversationSidebar from "./ConversationSidebar";
import DocumentList from "./DocumentList";
import { MenuIcon, PlusIcon } from "./icons";
import PdfUpload from "./PdfUpload";
import type {
  ConversationDetail,
  ConversationSummary,
  DocumentOption,
  Message,
} from "./types";

// while a PDF is processing, ask again after 2s, then wait 1.5x longer each
// time up to 10s: processing takes 10-60s, so this asks far less often
const POLL_START_MS = 2000;
const POLL_MAX_MS = 10_000;

async function fetchDocuments(): Promise<DocumentOption[]> {
  const response = await fetch("/api/documents");
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? `Server error: ${response.status}`);
  }

  return data.documents;
}

async function fetchConversations(): Promise<ConversationSummary[]> {
  const response = await fetch("/api/conversations");
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? `Server error: ${response.status}`);
  }

  return data.conversations;
}

async function fetchConversation(id: string): Promise<ConversationDetail> {
  const response = await fetch(`/api/conversations/${id}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? `Server error: ${response.status}`);
  }

  return data.conversation;
}

type ChatLayoutProps = {
  isAdmin: boolean;
  userName: string;
  userRole: string;
  // loaded by the server page, so the first render already has them
  initialConversations: ConversationSummary[];
  initialDocuments: DocumentOption[];
  // the one in ?c=, if any
  initialConversation: ConversationDetail | null;
};

function ChatLayout({
  isAdmin,
  userName,
  userRole,
  initialConversations,
  initialDocuments,
  initialConversation,
}: ChatLayoutProps) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [conversations, setConversations] = useState(initialConversations);
  const [activeConversation, setActiveConversation] =
    useState<ConversationDetail | null>(initialConversation);
  // bump to remount ChatWindow
  const [chatKey, setChatKey] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const toMessages = (conversation: ConversationDetail): Message[] =>
    withPendingApproval(
      conversation.messages.map((message) => ({
        role: message.role,
        text: message.text,
        sources: message.sources ?? undefined,
      })),
      conversation.pendingApproval,
    );

  const showChat = (conversation: ConversationDetail | null) => {
    setActiveConversation(conversation);
    setSidebarOpen(false);
    setChatKey((key) => key + 1);
    window.history.replaceState(
      null,
      "",
      conversation ? `?c=${conversation.id}` : window.location.pathname,
    );
  };

  const newChat = () => showChat(null);

  // only this conversation's messages, fetched fresh in case it changed
  const selectConversation = async (conversationId: string) => {
    try {
      showChat(await fetchConversation(conversationId));
    } catch (error) {
      console.error("Could not load conversation", error);
    }
  };

  const loadConversations = () =>
    fetchConversations()
      .then(setConversations)
      .catch((error) => console.error("Could not load conversations", error));

  // don't remount here, the chat is still streaming
  const handleConversationCreated = (conversationId: string) => {
    window.history.replaceState(null, "", `?c=${conversationId}`);
    loadConversations();
  };

  // poll while something is still processing
  const processing = documents.some((doc) => doc.status === "processing");
  // bumped by each upload, so polling starts again from the short delay
  const [uploadCount, setUploadCount] = useState(0);

  useEffect(() => {
    if (!processing) {
      return;
    }

    let delay = POLL_START_MS;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    const schedule = () => {
      timer = setTimeout(poll, delay);
      delay = Math.min(delay * 1.5, POLL_MAX_MS);
    };

    async function poll() {
      // nobody is looking; check again when the tab is visible
      if (document.visibilityState === "hidden") {
        return;
      }

      try {
        setDocuments(await fetchDocuments());
      } catch (error) {
        console.error("Could not load documents", error);
      }

      if (!stopped) {
        schedule();
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        clearTimeout(timer);
        delay = POLL_START_MS;
        poll();
      }
    };

    schedule();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [processing, uploadCount]);

  const handleDeleteConversation = async (deletedId: string) => {
    const response = await fetch(`/api/conversations/${deletedId}`, {
      method: "DELETE",
    });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(data?.error ?? `Server error: ${response.status}`);
    }

    setConversations((prev) => prev.filter((c) => c.id !== deletedId));

    if (activeConversation?.id === deletedId) {
      showChat(null);
    }
  };

  const handleDeleteDocument = async (deletedId: string) => {
    const response = await fetch(`/api/documents/${deletedId}`, {
      method: "DELETE",
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error ?? `Server error: ${response.status}`);
    }

    setDocuments((prev) => prev.filter((doc) => doc.id !== deletedId));
  };

  // the upload response is the new document, so no extra fetch is needed
  const handleUploaded = (uploaded: DocumentOption) => {
    setDocuments((prev) => [
      uploaded,
      ...prev.filter((doc) => doc.id !== uploaded.id),
    ]);
    setUploadCount((count) => count + 1);
  };

  return (
    <div className="flex h-dvh w-full bg-white dark:bg-zinc-950">
      <ConversationSidebar
        conversations={conversations}
        activeId={activeConversation?.id}
        onNewChat={newChat}
        onSelect={selectConversation}
        onDelete={handleDeleteConversation}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        nav={<NavLinks isAdmin={isAdmin} variant="vertical" />}
        footer={
          <>
            <DocumentList
              documents={documents}
              onDelete={isAdmin ? handleDeleteDocument : undefined}
              upload={
                isAdmin ? <PdfUpload onUploaded={handleUploaded} /> : undefined
              }
            />
            <UserCard name={userName} role={userRole} />
          </>
        }
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-zinc-200/70 bg-white/80 px-4 backdrop-blur dark:border-zinc-800/70 dark:bg-zinc-950/80">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
            className="-ml-1.5 rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 md:hidden dark:hover:bg-zinc-800"
          >
            <MenuIcon className="size-5" />
          </button>

          <h1 className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {activeConversation?.title ?? "New chat"}
          </h1>

          <button
            type="button"
            onClick={newChat}
            aria-label="New chat"
            className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 md:hidden dark:hover:bg-zinc-800"
          >
            <PlusIcon className="size-5" />
          </button>
        </header>

        <ChatWindow
          key={chatKey}
          initialConversationId={activeConversation?.id ?? ""}
          initialMessages={
            activeConversation ? toMessages(activeConversation) : []
          }
          documents={documents}
          firstName={userName.split(" ")[0]}
          onConversationCreated={handleConversationCreated}
        />
      </div>
    </div>
  );
}

export default ChatLayout;
