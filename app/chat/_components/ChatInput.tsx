'use client'
import { useRef, useState } from "react";
import { SendIcon } from "./icons";

type ChatInputProps = {
  onSend: (text: string) => void;
  loading: boolean;
  // Shown inside the composer, left of the send button
  toolbar?: React.ReactNode;
};

// Tallest the text box grows before it scrolls
const MAX_HEIGHT = 200;

function ChatInput({ onSend, loading, toolbar }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Grow the text box with its content
  const resize = () => {
    const el = textareaRef.current;
    if (!el) return;

    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  };

  const submit = () => {
    const text = message.trim();
    if (!text || loading) return;

    onSend(text);
    setMessage("");
    requestAnimationFrame(resize);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    submit();
  };

  // Enter sends, Shift+Enter adds a new line
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="px-4 pt-2 pb-4">
      <form
        className="mx-auto w-full max-w-3xl rounded-2xl border border-zinc-200 bg-white shadow-sm transition focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-500/10 dark:border-zinc-700 dark:bg-zinc-900"
        onSubmit={handleSubmit}
      >
        <textarea
          ref={textareaRef}
          rows={1}
          className="block w-full resize-none bg-transparent px-4 pt-3.5 pb-1 text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-50"
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            resize();
          }}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question about your documents..."
          aria-label="Message"
          autoFocus
        />

        <div className="flex items-center justify-between gap-2 px-2 pb-2">
          <div className="min-w-0">{toolbar}</div>

          <button
            type="submit"
            disabled={loading || !message.trim()}
            aria-label={loading ? "Sending" : "Send"}
            className="grid size-9 shrink-0 place-items-center rounded-xl bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600"
          >
            {loading ? (
              <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <SendIcon className="size-4" />
            )}
          </button>
        </div>
      </form>

      <p className="mt-2 text-center text-xs text-zinc-400">
        Answers come from your uploaded PDFs. Check the sources.
      </p>
    </div>
  );
}

export default ChatInput;
