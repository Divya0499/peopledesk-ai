import type { ReactNode } from "react";
import { ChatIcon, CloseIcon, PlusIcon, SparkIcon } from "./icons";
import type { ConversationSummary } from "./types";

type ConversationSidebarProps = {
  conversations: ConversationSummary[];
  // The open conversation, highlighted in the list
  activeId?: string;
  onNewChat: () => void;
  onSelect: (conversationId: string) => void;
  // Small screens show the sidebar as a drawer over the chat
  open: boolean;
  onClose: () => void;
  // Shown below the history, e.g. the document list
  footer?: ReactNode;
};

function ConversationSidebar({
  conversations,
  activeId,
  onNewChat,
  onSelect,
  open,
  onClose,
  footer,
}: ConversationSidebarProps) {
  return (
    <>
      {/* Backdrop behind the drawer on small screens */}
      <div
        onClick={onClose}
        aria-hidden
        className={`fixed inset-0 z-30 bg-zinc-950/40 backdrop-blur-sm transition-opacity md:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50 transition-transform md:static md:translate-x-0 dark:border-zinc-800 dark:bg-zinc-900 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-indigo-600 text-white">
              <SparkIcon className="size-4" />
            </span>
            <span className="font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              My AI App
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close sidebar"
            className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-200 md:hidden dark:hover:bg-zinc-800"
          >
            <CloseIcon className="size-5" />
          </button>
        </div>

        <div className="px-3 pb-2">
          <button
            type="button"
            onClick={onNewChat}
            className="flex w-full items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm ring-1 ring-zinc-200 transition hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-50 dark:ring-zinc-700 dark:hover:bg-zinc-700"
          >
            <PlusIcon className="size-4" />
            New chat
          </button>
        </div>

        <h2 className="px-4 pt-3 pb-1.5 text-xs font-medium text-zinc-500">
          Recent
        </h2>

        <nav className="flex-1 overflow-y-auto px-3 pb-4">
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
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-zinc-600 transition hover:bg-zinc-200/60 hover:text-zinc-900 aria-[current]:bg-zinc-200/80 aria-[current]:font-medium aria-[current]:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 dark:aria-[current]:bg-zinc-800 dark:aria-[current]:text-zinc-50"
              >
                <ChatIcon className="size-4 shrink-0 opacity-60" />
                <span className="truncate">
                  {conversation.title ?? "New Conversation"}
                </span>
              </button>
            ))
          )}
        </nav>

        {footer}
      </aside>
    </>
  );
}

export default ConversationSidebar;
