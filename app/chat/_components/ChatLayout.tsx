"use client";
import { useEffect, useState } from "react";
import ChatWindow from "./ChatWindow";
import ConversationSidebar from "./ConversationSidebar";
import DocumentList from "./DocumentList";
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

// Holds the document list so the upload button and the
// chat's document dropdown stay in sync
function ChatLayout() {
  const [documents, setDocuments] = useState<DocumentOption[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(true);
  // "" means search all documents
  const [documentId, setDocumentId] = useState("");
  const [conversations, setConversations] = useState<ConversationSummary[]>(
    [],
  );
  // The chat currently shown, or null for a new, unsaved chat
  const [activeConversation, setActiveConversation] =
    useState<ConversationSummary | null>(null);
  // Changing the key remounts ChatWindow so it starts from the
  // selected conversation (or empty for a new chat)
  const [chatKey, setChatKey] = useState(0);
  // Turn a saved conversation's messages into the chat's message format
  const toMessages = (conversation: ConversationSummary): Message[] =>
    conversation.messages.map((message) => ({
      role: message.role,
      text: message.text,
      sources: message.sources ?? undefined,
    }));

  const showChat = (conversation: ConversationSummary | null) => {
    setActiveConversation(conversation);
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
    <div className="flex h-dvh w-full flex-col bg-zinc-50 dark:bg-black">
      <header className="border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4">
          <h1 className="shrink-0 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            My AI App
          </h1>

          <PdfUpload onUploaded={handleUploaded} />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <ConversationSidebar
          conversations={conversations}
          activeId={activeConversation?.id}
          onNewChat={newChat}
          onSelect={selectConversation}
          footer={
            <DocumentList
              documents={documents}
              onDelete={handleDeleteDocument}
            />
          }
        />

        <div className="flex min-w-0 flex-1 flex-col">
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
    </div>
  );
}

export default ChatLayout;
