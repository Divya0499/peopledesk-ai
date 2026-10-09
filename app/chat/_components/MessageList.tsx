import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import ApprovalCard from "./ApprovalCard";
import { SparkIcon } from "./icons";
import SourceList from "./SourceList";
import type { Message } from "./types";

type MessageListProps = {
  messages: Message[];
  loading: boolean;
  hasDocuments: boolean;
  onSuggestion: (text: string) => void;
  onApprovalDecision: (index: number, approved: boolean) => void;
};

// document questions only show up once there's a PDF
const HR_SUGGESTIONS = [
  "How many leaves do I have?",
  "What can you help me with?",
];
const DOCUMENT_SUGGESTIONS = [
  "What are the key policies I should know?",
  "Summarize the main points",
];

function Avatar() {
  return (
    <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-indigo-600 text-white">
      <SparkIcon className="size-3.5" />
    </span>
  );
}

function MessageList({
  messages,
  loading,
  hasDocuments,
  onSuggestion,
  onApprovalDecision,
}: MessageListProps) {
  const last = messages[messages.length - 1];
  const waiting = loading && !(last?.role === "ai" && last.text);

  if (messages.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center pt-[12vh] text-center">
        <span className="grid size-12 place-items-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/20">
          <SparkIcon className="size-6" />
        </span>
        <h2 className="mt-5 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          What would you like to know?
        </h2>
        <p className="mt-2 max-w-md text-zinc-500">
          Check your leave balance, apply for leave, or ask about company
          documents.
        </p>

        <div className="mt-8 grid w-full max-w-xl gap-2 sm:grid-cols-2">
          {[
            ...HR_SUGGESTIONS,
            ...(hasDocuments ? DOCUMENT_SUGGESTIONS : []),
          ].map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => onSuggestion(suggestion)}
              className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-left text-sm text-zinc-700 transition hover:border-indigo-300 hover:bg-indigo-50/50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/30"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      {messages.map((msg, i) =>
        msg.role === "user" ? (
          <div key={i} className="flex justify-end">
            <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-zinc-900 px-4 py-2.5 text-white dark:bg-zinc-100 dark:text-zinc-900">
              {msg.text}
            </div>
          </div>
        ) : msg.role === "ai" ? (
          msg.text && (
            <div key={i} className="flex gap-3">
              <Avatar />
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <div className="prose prose-zinc max-w-none pt-0.5 dark:prose-invert prose-pre:bg-zinc-900 prose-a:text-indigo-600 dark:prose-a:text-indigo-400">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.text}
                  </ReactMarkdown>
                </div>

                {msg.sources && msg.sources.length > 0 && (
                  <SourceList sources={msg.sources} />
                )}

                {msg.approval && (
                  <ApprovalCard
                    approval={msg.approval}
                    disabled={loading}
                    onDecision={(approved) => onApprovalDecision(i, approved)}
                  />
                )}
              </div>
            </div>
          )
        ) : (
          <div key={i} className="flex gap-3">
            <Avatar />
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-400">
              {msg.text}
            </div>
          </div>
        ),
      )}

      {waiting && (
        <div className="flex items-center gap-3" aria-label="Thinking">
          <Avatar />
          <div className="flex gap-1">
            {[0, 150, 300].map((delay) => (
              <span
                key={delay}
                className="size-2 animate-bounce rounded-full bg-zinc-400"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export default MessageList;
