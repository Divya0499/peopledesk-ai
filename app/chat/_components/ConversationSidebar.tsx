import { type ReactNode, useState } from "react";
import Logo from "@/app/_components/Logo";
import ConfirmDialog from "./ConfirmDialog";
import { ChatIcon, CloseIcon, PlusIcon, TrashIcon } from "./icons";
import type { ConversationSummary } from "./types";

type ConversationSidebarProps = {
  conversations: ConversationSummary[];
  activeId?: string;
  onNewChat: () => void;
  onSelect: (conversationId: string) => void;
  onDelete: (conversationId: string) => Promise<void>;
  // drawer on mobile
  open: boolean;
  onClose: () => void;
  // links to the other pages, under New chat
  nav?: ReactNode;
  footer?: ReactNode;
};

function ConversationSidebar({
  conversations,
  activeId,
  onNewChat,
  onSelect,
  onDelete,
  open,
  onClose,
  nav,
  footer,
}: ConversationSidebarProps) {
  const [pendingDelete, setPendingDelete] =
    useState<ConversationSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const askToDelete = (conversation: ConversationSummary) => {
    setError("");
    setPendingDelete(conversation);
  };

  const closeDialog = () => {
    setPendingDelete(null);
    setError("");
  };

  const confirmDelete = async () => {
    if (!pendingDelete) {
      return;
    }

    setDeleting(true);
    setError("");

    try {
      await onDelete(pendingDelete.id);
      setPendingDelete(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete conversation",
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden
        className={`fixed inset-0 z-30 bg-zinc-950/40 backdrop-blur-sm transition-opacity md:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50/95 transition-transform md:static md:translate-x-0 dark:border-zinc-800 dark:bg-zinc-900 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <Logo />

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
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-2.5 text-sm font-medium text-white shadow-md shadow-indigo-500/20 transition hover:from-indigo-500 hover:to-violet-500"
          >
            <PlusIcon className="size-4" />
            New chat
          </button>
        </div>

        {nav && <div className="px-3 pt-2 pb-1">{nav}</div>}

        <h2 className="px-5 pt-4 pb-1.5 text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
          Recent chats
        </h2>

        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {conversations.length === 0 ? (
            <p className="px-2 py-1.5 text-sm text-zinc-400">
              No conversations yet
            </p>
          ) : (
            conversations.map((conversation) => {
              const title = conversation.title ?? "New Conversation";

              return (
                <div
                  key={conversation.id}
                  aria-current={
                    conversation.id === activeId ? "true" : undefined
                  }
                  className="group flex items-center rounded-lg text-sm text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 aria-[current]:bg-white aria-[current]:font-medium aria-[current]:text-zinc-900 aria-[current]:shadow-sm aria-[current]:ring-1 aria-[current]:ring-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 dark:aria-[current]:bg-zinc-800 dark:aria-[current]:text-zinc-50 dark:aria-[current]:ring-zinc-700"
                >
                  <button
                    type="button"
                    onClick={() => onSelect(conversation.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left"
                  >
                    <ChatIcon className="size-4 shrink-0 opacity-60" />
                    <span className="truncate">{title}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => askToDelete(conversation)}
                    disabled={deleting}
                    aria-label={`Delete ${title}`}
                    title="Delete"
                    // no hover on mobile so always show it there
                    className="mr-1 shrink-0 rounded p-1 text-zinc-400 transition hover:bg-red-100 hover:text-red-600 focus-visible:opacity-100 disabled:cursor-not-allowed disabled:opacity-50 md:opacity-0 md:group-hover:opacity-100 dark:hover:bg-red-950 dark:hover:text-red-400"
                  >
                    <TrashIcon className="size-3.5" />
                  </button>
                </div>
              );
            })
          )}

        </nav>

        {footer}
      </aside>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete chat?"
        description={`"${pendingDelete?.title ?? "New Conversation"}" and all its messages will be permanently deleted. This can't be undone.`}
        confirmLabel="Delete"
        busy={deleting}
        error={error}
        onConfirm={confirmDelete}
        onCancel={closeDialog}
      />
    </>
  );
}

export default ConversationSidebar;
