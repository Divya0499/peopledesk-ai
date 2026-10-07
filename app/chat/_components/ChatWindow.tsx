"use client";
import { useEffect, useRef, useState } from "react";
import ChatInput from "./ChatInput";
import DocumentSelect from "./DocumentSelect";
import MessageList from "./MessageList";
import { type ApprovalEvent, pendingApprovalText, toApproval } from "./approval";
import type { Approval, DocumentOption, Message, Source } from "./types";

// "docs" asks the uploaded PDFs (/api/chat). "agent" asks the HR assistant
// graph (/api/langgraph-test), which can check and apply leave.
type ChatMode = "docs" | "agent";

// A response from /api/langgraph-test or its /resume route
type AgentResponse =
  | {
      status: "pending_approval";
      threadId: string;
      approval: {
        // applyLeave only takes days: the employee comes from the session,
        // never from the model, so there's no userId to show
        toolCall: { args: { days: number } };
      };
    }
  | { status: "done"; text: string };

// Turns the graph's response into a chat message: its answer, or a leave
// application with Approve / Reject buttons when the run paused
function agentMessage(data: AgentResponse): Message {
  if (data.status === "pending_approval") {
    const { days } = data.approval.toolCall.args;

    return {
      role: "ai",
      text: "I've prepared your leave application. It needs approval before it's submitted.",
      approval: {
        threadId: data.threadId,
        via: "agent",
        message: "Please approve the leave application.",
        toolName: "applyLeave",
        days,
        status: "pending",
      },
    };
  }

  return { role: "ai", text: data.text || "No answer was returned." };
}

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
  const [mode, setMode] = useState<ChatMode>("docs");
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

  // HR assistant mode: one question per graph run, not saved to the
  // conversation (the graph keeps its own state, in memory only)
  const sendToAgent = async (text: string) => {
    setMessages((prev) => [...prev, { role: "user", text }]);
    setLoading(true);

    try {
      const response = await fetch("/api/langgraph-test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // One key per question: applyLeave uses it so a retry of the
          // same application can't deduct the leave twice
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({ question: text }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? `Server error: ${response.status}`);
      }

      setMessages((prev) => [...prev, agentMessage(data)]);
    } catch (err) {
      addError(err);
    } finally {
      setLoading(false);
    }
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

    // /api/chat runs: the reply streams back like any chat answer, and the
    // server saves it to the conversation. Only threadId and the decision
    // are sent; the server knows who's asking and which conversation it is.
    if (approval.via === "chat") {
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

      return;
    }

    try {
      const response = await fetch("/api/langgraph-test/resume", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ threadId: approval.threadId, approved }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? `Server error: ${response.status}`);
      }

      // Mark the card decided so its buttons go away, then add the reply
      setMessages((prev) => [
        ...prev.map((message, i) =>
          i === index
            ? {
                ...message,
                approval: {
                  ...approval,
                  status: approved ? ("approved" as const) : ("rejected" as const),
                },
              }
            : message,
        ),
        agentMessage(data),
      ]);
    } catch (err) {
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
    if (mode === "agent") {
      return sendToAgent(text);
    }

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
            hasDocuments={documents.length > 0}
            onSuggestion={sendMessage}
            onApprovalDecision={decideApproval}
          />
          <div ref={bottomRef} />
        </div>
      </main>

      {/* Input, with the PDF to search inside the composer */}
      <ChatInput
        onSend={sendMessage}
        loading={loading}
        placeholder={
          mode === "agent"
            ? "Ask about your leave, e.g. Apply 3 days leave..."
            : undefined
        }
        hint={
          mode === "agent"
            ? "The HR assistant can apply leave. Nothing is submitted until you approve it."
            : undefined
        }
        toolbar={
          <div className="flex items-center gap-2">
            <div
              role="group"
              aria-label="Chat mode"
              className="flex rounded-lg bg-zinc-100 p-0.5 text-xs font-medium dark:bg-zinc-800"
            >
              {(
                [
                  ["docs", "Documents"],
                  ["agent", "HR assistant"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMode(value)}
                  disabled={loading}
                  aria-pressed={mode === value}
                  className={`rounded-md px-2.5 py-1 transition disabled:cursor-not-allowed ${
                    mode === value
                      ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-50"
                      : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* The HR assistant searches all documents itself */}
            {mode === "docs" && (
              <DocumentSelect
                documents={documents}
                value={documentId}
                onChange={onDocumentChange}
                disabled={loading || loadingDocuments}
              />
            )}
          </div>
        }
      />
    </>
  );
}

export default ChatWindow;
