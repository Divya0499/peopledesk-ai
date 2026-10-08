"use client";
import { useEffect, useState } from "react";
import { withPendingApproval } from "./approval";
import ChatWindow from "./ChatWindow";
import ConversationSidebar from "./ConversationSidebar";
import DocumentList from "./DocumentList";
import { MenuIcon, PlusIcon } from "./icons";
import LogoutButton from "./LogoutButton";
import PdfUpload from "./PdfUpload";
import type { ConversationSummary, DocumentOption, Message } from "./types";

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
  // Uploading and deleting documents are admin-only, so others don't get
  // the buttons
  isAdmin: boolean;
};

// Holds the document list so the upload button and the
// chat's document dropdown stay in sync
function ChatLayout({ isAdmin }: ChatLayoutProps) {
  const [documents, setDocuments] = useState<DocumentOption[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(true);
  // "" means search all documents
  const [documentId, setDocumentId] = useState("");
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  // The chat currently shown, or null for a new, unsaved chat
  const [activeConversation, setActiveConversation] =
    useState<ConversationSummary | null>(null);
  // Changing the key remounts ChatWindow so it starts from the
  // selected conversation (or empty for a new chat)
  const [chatKey, setChatKey] = useState(0);
  // Sidebar drawer on small screens; always shown from md up
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Turn a saved conversation's messages into the chat's message format,
  // with the Approve / Reject card back on a leave application that's still
  // waiting (the server read it from the paused run)
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
    // Keep the open chat in the URL so a reload brings it back
    window.history.replaceState(
      null,
      "",
      conversation ? `?c=${conversation.id}` : window.location.pathname,
    );
  };

  const newChat = () => showChat(null);

  // Re-fetch before opening so messages sent since the last load are included
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

  // A chat was created from the first message: list it in the sidebar and
  // put it in the URL, without remounting the chat that's still streaming
  const handleConversationCreated = (conversationId: string) => {
    window.history.replaceState(null, "", `?c=${conversationId}`);
    loadConversations();
  };

  useEffect(() => {
    const openId = new URLSearchParams(window.location.search).get("c");

    fetchConversations()
      .then((loaded) => {
        setConversations(loaded);

        // Reopen the chat from the URL after a reload
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
      // The chat still works without the list, it just searches everything
      .catch((error) => console.error("Could not load documents", error))
      .finally(() => setLoadingDocuments(false));
  }, []);

  // Deletes a chat; errors are shown by ConversationSidebar. If it was the
  // open one, start a new chat instead of showing a deleted conversation.
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

  // Removes the PDF from PostgreSQL and Pinecone; errors are shown by DocumentList
  const handleDeleteDocument = async (deletedId: string) => {
    const response = await fetch(`/api/documents/${deletedId}`, {
      method: "DELETE",
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error ?? `Server error: ${response.status}`);
    }

    setDocuments((prev) => prev.filter((doc) => doc.id !== deletedId));

    // Don't keep searching a document that no longer exists
    if (documentId === deletedId) {
      setDocumentId("");
    }
  };

  // Show the new PDF in the dropdown and chat with it straight away
  const handleUploaded = async (uploadedId: string) => {
    try {
      setDocuments(await fetchDocuments());
      setDocumentId(uploadedId);
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

          <LogoutButton />
        </header>

        <ChatWindow
          key={chatKey}
          initialConversationId={activeConversation?.id ?? ""}
          initialMessages={
            activeConversation ? toMessages(activeConversation) : []
          }
          documents={documents}
          loadingDocuments={loadingDocuments}
          documentId={documentId}
          onDocumentChange={setDocumentId}
          onConversationCreated={handleConversationCreated}
        />
      </div>
    </div>
  );
}

export default ChatLayout;
