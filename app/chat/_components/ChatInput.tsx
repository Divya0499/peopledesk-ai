'use client'
import { useState } from "react";

type ChatInputProps = {
  onSend: (text: string) => void;
  loading: boolean;
  // Shown above the text box
  toolbar?: React.ReactNode;
};

function ChatInput({ onSend, loading, toolbar }: ChatInputProps) {
  const [message, setMessage] = useState("");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const text = message.trim();
    if (!text || loading) return;

    onSend(text);
    setMessage("");
  };

  return (
    <div className="border-t border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      {toolbar && <div className="mb-3">{toolbar}</div>}

      <form className="mx-auto flex w-full max-w-3xl gap-2" onSubmit={handleSubmit}>
        <input
          className="flex-1 rounded-lg border border-zinc-300 bg-transparent px-4 py-2 text-zinc-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-zinc-700 dark:text-zinc-50"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Ask something..."
          autoFocus
        />

        <button
          type="submit"
          disabled={loading || !message.trim()}
          className="rounded-lg bg-blue-600 px-5 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Sending..." : "Send"}
        </button>
      </form>
    </div>
  );
}

export default ChatInput;
