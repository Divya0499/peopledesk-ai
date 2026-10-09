"use client";
import { useEffect, useRef, useState } from "react";
import ChatInput from "./ChatInput";
import MessageList from "./MessageList";
import { type ApprovalEvent, pendingApprovalText, toApproval } from "./approval";
import type { Approval, DocumentOption, Message, Source } from "./types";

type ChatWindowProps = {
  documents: DocumentOption[];
  initialConversationId: string;
  initialMessages: Message[];
  onConversationCreated: (conversationId: string) => void;
};

function ChatWindow({
  documents,
  initialConversationId,
  initialMessages,
  onConversationCreated,
}: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState(initialConversationId);
  const bottomRef = useRef<HTMLDivElement>(null);

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

  const addError = (err: unknown) => {
    const errorText =
      err instanceof Error ? err.message : "Something went wrong";

    setMessages((prev) => [...prev, { role: "error", text: errorText }]);
  };

  const decideApproval = async (index: number, approved: boolean) => {
    const approval = messages[index]?.approval;

    if (!approval || approval.status !== "pending") {
      return;
    }

    const markDecided = () =>
      setMessages((prev) =>
        prev.map((message, i) =>
          i === index
            ? {
                ...message,
                approval: {
                  ...approval,
                  status: approved
                    ? ("approved" as const)
                    : ("rejected" as const),
                },
              }
            : message,
        ),
      );

    setLoading(true);

    try {
        const response = await fetch("/api/chat/resume", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ threadId: approval.threadId, approved }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => null);

          throw new Error(data?.error ?? `Server error: ${response.status}`);
        }

      await streamAiReply(response);
      markDecided();
    } catch (err) {
      // card stays pending so they can try again
      addError(err);
    } finally {
      setLoading(false);
    }
  };

  // reads the NDJSON stream from /api/chat or /api/chat/resume
  const streamAiReply = async (response: Response) => {
    if (!response.body) {
      throw new Error("No response body");
    }

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
    const sourceMap = new Map<string, Source>();
    let sources: Source[] | undefined;
    let approval: Approval | undefined;
    let streamError: string | undefined;
    let buffer = "";

    const updateAiMessage = () =>
      setMessages((prev) => {
        const updated = [...prev];

        updated[updated.length - 1] = {
          role: "ai",
          text: result,
          sources,
          approval,
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

      // last line might be incomplete, keep it for the next chunk
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) {
          continue;
        }

        const event = JSON.parse(line);

        // TODO: show tool_start / tool_result in the UI
        if (event.type === "text") {
          result += event.content;
        } else if (event.type === "sources") {
          for (const source of event.sources as Source[]) {
            sourceMap.set(source.id, source);
          }

          sources = [...sourceMap.values()];
        } else if (event.type === "approval") {
          const pending = event as ApprovalEvent;

          result = pendingApprovalText(pending);
          approval = toApproval(pending);
        } else if (event.type === "error") {
          streamError = event.message;
        }
      }

      updateAiMessage();
    }

    if (streamError) {
      if (!result) {
        setMessages((prev) => prev.slice(0, -1));
      }

      throw new Error(streamError);
    }

    if (!result) {
      result = "No answer was returned.";
      updateAiMessage();
    }
  };

  const sendMessage = async (text: string) => {
    setMessages((prev) => [...prev, { role: "user", text }]);
    setLoading(true);

    try {
      let currentConversationId = conversationId;

      if (!currentConversationId) {
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
          conversationId: currentConversationId,
          question: text,
        }),
      });

      if (!response.ok) {
        const data = await response.json();

        throw new Error(data.error ?? `Server error: ${response.status}`);
      }

      await streamAiReply(response);
    } catch (err) {
      addError(err);
    } finally {
      setLoading(false);
    }
  };
  return (
    <>
      <main className="flex-1 overflow-y-auto px-4 py-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
          <MessageList
            messages={messages}
            loading={loading}
            hasDocuments={documents.some((doc) => doc.status === "ready")}
            onSuggestion={sendMessage}
            onApprovalDecision={decideApproval}
          />
          <div ref={bottomRef} />
        </div>
      </main>

      <ChatInput onSend={sendMessage} loading={loading} />
    </>
  );
}

export default ChatWindow;
