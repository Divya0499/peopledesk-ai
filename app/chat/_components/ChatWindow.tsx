"use client";
import { useEffect, useRef, useState } from "react";
import ChatInput from "./ChatInput";
import DocumentSelect from "./DocumentSelect";
import MessageList from "./MessageList";
import type { DocumentOption, Message, Source } from "./types";

type ChatWindowProps = {
  documents: DocumentOption[];
  loadingDocuments: boolean;
  // "" means search all documents
  documentId: string;
  onDocumentChange: (documentId: string) => void;
  // A saved conversation to continue; "" and [] for a new chat
  initialConversationId: string;
  initialMessages: Message[];
  onConversationCreated: (conversationId: string) => void;
};

function ChatWindow({
  documents,
  loadingDocuments,
  documentId,
  onDocumentChange,
  initialConversationId,
  initialMessages,
  onConversationCreated,
}: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [loading, setLoading] = useState(false);
  // "" until the first message creates a conversation
  const [conversationId, setConversationId] = useState(initialConversationId);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Scroll to the newest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const createConversation = async (title: string): Promise<string> => {
    const response = await fetch("/api/conversations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error ?? "Failed to create conversation");
    }

    setConversationId(data.conversation.id);
    onConversationCreated(data.conversation.id);

    return data.conversation.id;
  };

  const sendMessage = async (text: string) => {
    const userMessage = {
      role: "user" as const,
      text,
    };

    // Create conversation including the new user message
    const conversation = [...messages, userMessage];

    // Show user message immediately
    setMessages(conversation);
    setLoading(true);

    try {
      let currentConversationId = conversationId;

      // First question: create the conversation before sending it
      if (!currentConversationId) {
        // Title the chat after its first question, kept short for the sidebar
        const question = text.trim();
        const title =
          question.length > 40 ? `${question.slice(0, 40).trimEnd()}…` : question;

        currentConversationId = await createConversation(title);
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          // Error messages are only for the UI, don't send them to the AI
          messages: conversation
            .filter((m) => m.role !== "error")
            // Sources are only for the UI, send just the chat text
            .map(({ role, text }) => ({ role, text })),
          // Omitted when "All documents" is selected
          documentId: documentId || undefined,
          conversationId: currentConversationId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();

        throw new Error(data.error ?? `Server error: ${response.status}`);
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      // Add empty AI message
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: "",
        },
      ]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let result = "";
      let sources: Source[] | undefined;
      // Holds a JSON line that was split across two network chunks
      let buffer = "";

      const updateAiMessage = () =>
        setMessages((prev) => {
          const updated = [...prev];

          updated[updated.length - 1] = {
            role: "ai",
            text: result,
            sources,
          };

          return updated;
        });

      while (true) {
        const { value, done } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, {
          stream: true,
        });

        // The server sends one JSON event per line; the last piece may be
        // an incomplete line, so keep it for the next chunk
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) {
            continue;
          }

          const event = JSON.parse(line);

          if (event.type === "text") {
            result += event.text;
          } else if (event.type === "sources") {
            sources = event.sources;
          }
        }

        updateAiMessage();
      }
    } catch (err) {
      const errorText =
        err instanceof Error ? err.message : "Something went wrong";

      setMessages((prev) => [
        ...prev,
        {
          role: "error",
          text: errorText,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };
  return (
    <>
      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          <MessageList messages={messages} loading={loading} />
          <div ref={bottomRef} />
        </div>
      </main>

      {/* Input, with the PDF to search above it */}
      <ChatInput
        onSend={sendMessage}
        loading={loading}
        toolbar={
          <DocumentSelect
            documents={documents}
            value={documentId}
            onChange={onDocumentChange}
            disabled={loading || loadingDocuments}
          />
        }
      />
    </>
  );
}

export default ChatWindow;
