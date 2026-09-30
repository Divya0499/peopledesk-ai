import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Message } from "./types";

type MessageListProps = {
  messages: Message[];
  loading: boolean;
};

function MessageList({ messages, loading }: MessageListProps) {
  return (
    <>
      {messages.length === 0 && !loading && (
        <p className="mt-20 text-center text-zinc-500">
          Upload a PDF, then ask a question about it.
        </p>
      )}

      {messages.map((msg, i) =>
        msg.role === "user" ? (
          <div key={i} className="flex justify-end">
            <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-blue-600 px-4 py-2 text-white">
              {msg.text}
            </div>
          </div>
        ) : msg.role === "ai" ? (
          <div key={i} className="flex justify-start">
            <div className="prose prose-zinc max-w-full rounded-2xl rounded-bl-sm bg-white px-4 py-2 shadow-sm dark:prose-invert dark:bg-zinc-800">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
            </div>
          </div>
        ) : (
          <div key={i} className="flex justify-start">
            <div className="max-w-[80%] rounded-2xl rounded-bl-sm bg-red-50 px-4 py-2 text-red-600 dark:bg-red-950 dark:text-red-400">
              {msg.text}
            </div>
          </div>
        )
      )}

      {loading && (
        <div className="flex justify-start">
          <div className="animate-pulse rounded-2xl rounded-bl-sm bg-white px-4 py-2 text-zinc-500 shadow-sm dark:bg-zinc-800">
            Thinking...
          </div>
        </div>
      )}
    </>
  );
}

export default MessageList;
