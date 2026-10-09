"use client";
import { useEffect, useState } from "react";
import NavLinks from "@/app/_components/NavLinks";
import { withPendingApproval } from "./approval";
import ChatWindow from "./ChatWindow";
import ConversationSidebar from "./ConversationSidebar";
import DocumentList from "./DocumentList";
import { MenuIcon, PlusIcon } from "./icons";
import LogoutButton from "./LogoutButton";
import PdfUpload from "./PdfUpload";
import type { ConversationSummary, DocumentOption, Message } from "./types";

const DOCUMENT_POLL_MS = 2000;

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

type ChatLayoutProps = {
  isAdmin: boolean;
};

function ChatLayout({ isAdmin }: ChatLayoutProps) {
  const [documents, setDocuments] = useState<DocumentOption[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversation, setActiveConversation] =
    useState<ConversationSummary | null>(null);
  // bump to remount ChatWindow
  const [chatKey, setChatKey] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const toMessages = (conversation: ConversationSummary): Message[] =>
    withPendingApproval(
      conversation.messages.map((message) => ({
        role: message.role,
        text: message.text,
        sources: message.sources ?? undefined,
      })),
      conversation.pendingApproval,
    );

  const showChat = (conversation: ConversationSummary | null) => {
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

  const selectConversation = async (conversationId: string) => {
    try {
      const latest = await fetchConversations();
      setConversations(latest);
      showChat(latest.find((c) => c.id === conversationId) ?? null);
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

  useEffect(() => {
    const openId = new URLSearchParams(window.location.search).get("c");

    fetchConversations()
      .then((loaded) => {
        setConversations(loaded);

        const open = loaded.find((c) => c.id === openId);

        if (open) {
          setActiveConversation(open);
          setChatKey((key) => key + 1);
        }
      })
      .catch((error) => console.error("Could not load conversations", error));
  }, []);

  useEffect(() => {
    fetchDocuments()
      .then(setDocuments)
      .catch((error) => console.error("Could not load documents", error));
  }, []);

  // poll while something is still processing
  const processing = documents.some((doc) => doc.status === "processing");

  useEffect(() => {
    if (!processing) {
      return;
    }

    const timer = setInterval(() => {
      fetchDocuments()
        .then(setDocuments)
        .catch((error) => console.error("Could not load documents", error));
    }, DOCUMENT_POLL_MS);

    return () => clearInterval(timer);
  }, [processing]);

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

  const handleUploaded = async () => {
    try {
      setDocuments(await fetchDocuments());
    } catch (error) {
      console.error("Could not load documents", error);
    }
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
        footer={
          <DocumentList
            documents={documents}
            onDelete={isAdmin ? handleDeleteDocument : undefined}
            upload={
              isAdmin ? <PdfUpload onUploaded={handleUploaded} /> : undefined
            }
          />
        }
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-zinc-100 px-4 dark:border-zinc-900">
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

          <NavLinks isAdmin={isAdmin} />
          <LogoutButton />
        </header>

        <ChatWindow
          key={chatKey}
          initialConversationId={activeConversation?.id ?? ""}
          initialMessages={
            activeConversation ? toMessages(activeConversation) : []
          }
          documents={documents}
          onConversationCreated={handleConversationCreated}
        />
      </div>
    </div>
  );
}

export default ChatLayout;
