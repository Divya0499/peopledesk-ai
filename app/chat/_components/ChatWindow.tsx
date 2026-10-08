"use client";
import { useEffect, useRef, useState } from "react";
import ChatInput from "./ChatInput";
import MessageList from "./MessageList";
import { type ApprovalEvent, pendingApprovalText, toApproval } from "./approval";
import type { Approval, DocumentOption, Message, Source } from "./types";

type ChatWindowProps = {
  documents: DocumentOption[];
  // A saved conversation to continue; "" and [] for a new chat
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

  const addError = (err: unknown) => {
    const errorText =
      err instanceof Error ? err.message : "Something went wrong";

    setMessages((prev) => [...prev, { role: "error", text: errorText }]);
  };

  // Resumes the run paused on the leave application in messages[index]
  const decideApproval = async (index: number, approved: boolean) => {
    const approval = messages[index]?.approval;

    if (!approval || approval.status !== "pending") {
      return;
    }

    // Shows the decision on the card, so its buttons go away
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

    // The reply streams back like any chat answer, and the server saves it
    // to the conversation. Only threadId and the decision are sent; the
    // server knows who's asking and which conversation it is.
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
      // The card stays pending, so the person can try again
      addError(err);
    } finally {
      setLoading(false);
    }
  };

  // Reads an /api/chat or /api/chat/resume response (one JSON event per
  // line) into a new AI message as it streams. An approval event turns that
  // message into an Approve / Reject card. Throws if the run failed.
  const streamAiReply = async (response: Response) => {
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
    // The agent may search the documents more than once, so each sources
    // event adds to these, keyed by chunk id, rather than replacing them
    const sourceMap = new Map<string, Source>();
    let sources: Source[] | undefined;
    // Set when the run paused for approval; shown as a card on the message
    let approval: Approval | undefined;
    // Sent as an event: the 200 has already gone out when a run fails
    let streamError: string | undefined;
    // Holds a JSON line that was split across two network chunks
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

      // The server sends one JSON event per line; the last piece may be
      // an incomplete line, so keep it for the next chunk
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) {
          continue;
        }

        const event = JSON.parse(line);

        // tool_start / tool_result aren't shown in the chat yet
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
      // Drop the AI bubble if the run failed before writing anything
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
    // Shown straight away. Only for the UI: the server keeps the
    // conversation itself and saves this question with its answer.
    setMessages((prev) => [...prev, { role: "user", text }]);
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
        // Just the new question: the server loads the earlier messages from
        // the database, so the client can't change what the AI was told
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
      {/* Messages */}
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
