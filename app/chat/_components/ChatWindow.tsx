"use client";
import { useEffect, useRef, useState } from "react";
import ChatInput from "./ChatInput";
import DocumentSelect from "./DocumentSelect";
import MessageList from "./MessageList";
import type { DocumentOption, Message } from "./types";

type ChatWindowProps = {
  documents: DocumentOption[];
  loadingDocuments: boolean;
  // "" means search all documents
  documentId: string;
  onDocumentChange: (documentId: string) => void;
};

function ChatWindow({
  documents,
  loadingDocuments,
  documentId,
  onDocumentChange,
}: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Scroll to the newest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

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
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          // Error messages are only for the UI, don't send them to the AI
          messages: conversation.filter((m) => m.role !== "error"),
          // Omitted when "All documents" is selected
          documentId: documentId || undefined,
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

      while (true) {
        const { value, done } = await reader.read();

        if (done) {
          break;
        }

        const chunk = decoder.decode(value, {
          stream: true,
        });

        result += chunk;

        setMessages((prev) => {
          const updated = [...prev];

          updated[updated.length - 1] = {
            role: "ai",
            text: result,
          };

          return updated;
        });
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
