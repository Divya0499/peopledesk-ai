import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import ApprovalCard from "./ApprovalCard";
import {
  BookIcon,
  CalendarIcon,
  ClockIcon,
  FileIcon,
  HelpIcon,
  SparkIcon,
} from "./icons";
import SourceList from "./SourceList";
import type { Message } from "./types";

type MessageListProps = {
  messages: Message[];
  loading: boolean;
  // what the assistant is doing right now, e.g. "Searching company policies…"
  status: string;
  firstName: string;
  hasDocuments: boolean;
  onSuggestion: (text: string) => void;
  onApprovalDecision: (index: number, approved: boolean) => void;
};

type Suggestion = {
  icon: typeof SparkIcon;
  title: string;
  prompt: string;
};

// document questions only show up once there's a PDF
const HR_SUGGESTIONS: Suggestion[] = [
  {
    icon: ClockIcon,
    title: "Check my balance",
    prompt: "How many leaves do I have?",
  },
  {
    icon: CalendarIcon,
    title: "Apply for leave",
    prompt: "I want to apply for 1 day of leave",
  },
  {
    icon: HelpIcon,
    title: "What can you do?",
    prompt: "What can you help me with?",
  },
];
const DOCUMENT_SUGGESTIONS: Suggestion[] = [
  {
    icon: BookIcon,
    title: "Key policies",
    prompt: "What are the key policies I should know?",
  },
  {
    icon: FileIcon,
    title: "Summarize documents",
    prompt: "Summarize the main points",
  },
];

function Avatar() {
  return (
    <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm shadow-indigo-500/25">
      <SparkIcon className="size-4" />
    </span>
  );
}

function MessageList({
  messages,
  loading,
  status,
  firstName,
  hasDocuments,
  onSuggestion,
  onApprovalDecision,
}: MessageListProps) {
  const last = messages[messages.length - 1];
  const waiting = loading && !(last?.role === "ai" && last.text);

  if (messages.length === 0 && !loading) {
    const suggestions = [
      ...HR_SUGGESTIONS,
      ...(hasDocuments ? DOCUMENT_SUGGESTIONS : []),
    ];

    return (
      <div className="flex flex-col items-center pt-4 text-center sm:pt-[8vh]">
        <span className="grid size-12 place-items-center sm:size-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-xl shadow-indigo-500/30">
          <SparkIcon className="size-7" />
        </span>
        <h2 className="mt-5 text-2xl font-semibold sm:mt-6 sm:text-3xl tracking-tight text-zinc-900 dark:text-zinc-50">
          Hi {firstName}, how can I help?
        </h2>
        <p className="mt-2 max-w-md text-zinc-500 dark:text-zinc-400">
          Check your leave balance, apply for leave, or ask anything about
          company policies.
        </p>

        <div className="mt-8 grid w-full max-w-2xl gap-2.5 sm:mt-10 sm:gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {suggestions.map((suggestion) => {
            const Icon = suggestion.icon;

            return (
              <button
                key={suggestion.prompt}
                type="button"
                onClick={() => onSuggestion(suggestion.prompt)}
                className="group flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-3.5 text-left shadow-sm transition sm:flex-col sm:items-start sm:p-4 hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md hover:shadow-indigo-500/10 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-700"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600 transition group-hover:bg-indigo-600 group-hover:text-white dark:bg-indigo-950/60 dark:text-indigo-400">
                  <Icon className="size-4.5" />
                </span>
                <span>
                  <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {suggestion.title}
                  </span>
                  <span className="mt-0.5 block text-xs text-zinc-500">
                    {suggestion.prompt}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <>
      {messages.map((msg, i) =>
        msg.role === "user" ? (
          <div key={i} className="message-in flex justify-end">
            <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-gradient-to-br from-indigo-600 to-violet-600 px-4 py-2.5 text-white shadow-sm shadow-indigo-500/20">
              {msg.text}
            </div>
          </div>
        ) : msg.role === "ai" ? (
          msg.text && (
            <div key={i} className="message-in flex gap-3">
              <Avatar />
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <div className="prose prose-zinc max-w-none pt-1 prose-p:leading-relaxed prose-headings:font-semibold dark:prose-invert prose-pre:bg-zinc-900 prose-a:text-indigo-600 dark:prose-a:text-indigo-400">
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
        <div className="message-in flex items-center gap-3" aria-label="Thinking">
          <Avatar />
          <div className="flex items-center gap-2 rounded-2xl bg-zinc-100 px-3.5 py-2.5 dark:bg-zinc-800/80">
            <div className="flex gap-1">
              {[0, 150, 300].map((delay) => (
                <span
                  key={delay}
                  className="size-1.5 animate-bounce rounded-full bg-indigo-500"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </div>
            <span className="text-xs text-zinc-500">
              {status || "Thinking…"}
            </span>
          </div>
        </div>
      )}
    </>
  );
}

export default MessageList;
