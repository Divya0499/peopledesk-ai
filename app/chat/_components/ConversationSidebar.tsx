import type { ReactNode } from "react";
import type { ConversationSummary } from "./types";

type ConversationSidebarProps = {
  conversations: ConversationSummary[];
  // The open conversation, highlighted in the list
  activeId?: string;
  onNewChat: () => void;
  onSelect: (conversationId: string) => void;
  // Shown below the history, e.g. the document list
  footer?: ReactNode;
};

function ConversationSidebar({
  conversations,
  activeId,
  onNewChat,
  onSelect,
  footer,
}: ConversationSidebarProps) {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-zinc-200 bg-white md:flex dark:border-zinc-800 dark:bg-zinc-900">
      <div className="p-2">
        <button
          type="button"
          onClick={onNewChat}
          className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-left text-sm font-medium text-zinc-900 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-800"
        >
          + New Chat
        </button>
      </div>

      <h2 className="px-4 pt-2 pb-2 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
        Chat History
      </h2>

      <nav className="flex-1 overflow-y-auto px-2 pb-4">
        {conversations.length === 0 ? (
          <p className="px-2 py-1.5 text-sm text-zinc-400">
            No conversations yet
          </p>
        ) : (
          conversations.map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              onClick={() => onSelect(conversation.id)}
              aria-current={conversation.id === activeId ? "true" : undefined}
              className="w-full truncate rounded-lg px-2 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-100 aria-[current]:bg-zinc-100 aria-[current]:font-medium aria-[current]:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:aria-[current]:bg-zinc-800 dark:aria-[current]:text-zinc-50"
            >
              {conversation.title ?? "New Conversation"}
            </button>
          ))
        )}
      </nav>

      {footer}
    </aside>
  );
}

export default ConversationSidebar;
