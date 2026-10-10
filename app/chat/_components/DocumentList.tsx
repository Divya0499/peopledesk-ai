"use client";
import { useState, type ReactNode } from "react";
import ConfirmDialog from "./ConfirmDialog";
import { FileIcon, TrashIcon } from "./icons";
import type { DocumentOption } from "./types";

type DocumentListProps = {
  documents: DocumentOption[];
  // not passed for non-admins
  onDelete?: (documentId: string) => Promise<void>;
  upload?: ReactNode;
};

function DocumentList({ documents, onDelete, upload }: DocumentListProps) {
  const [pendingDelete, setPendingDelete] = useState<DocumentOption | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const closeDialog = () => {
    setPendingDelete(null);
    setError("");
  };

  const confirmDelete = async () => {
    if (!pendingDelete || !onDelete) {
      return;
    }

    setDeleting(true);
    setError("");

    try {
      await onDelete(pendingDelete.id);
      setPendingDelete(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete document",
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="border-t border-zinc-200 dark:border-zinc-800">
      <h2 className="flex items-center justify-between px-5 pt-3 pb-1.5 text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
        Policy documents
        {documents.length > 0 && (
          <span className="rounded-full bg-zinc-200 px-1.5 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            {documents.length}
          </span>
        )}
      </h2>

      <ul className="max-h-40 overflow-y-auto px-3">
        {documents.length === 0 && (
          <li className="px-2 py-1.5 text-sm text-zinc-400">
            No documents uploaded
          </li>
        )}

        {documents.map((doc) => (
          <li
            key={doc.id}
            className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-zinc-200/60 dark:hover:bg-zinc-800"
          >
            {doc.status === "processing" ? (
              <span
                aria-hidden
                className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent"
              />
            ) : (
              <FileIcon
                className={`size-4 shrink-0 ${
                  doc.status === "ready" ? "text-indigo-500" : "text-red-500"
                }`}
              />
            )}
            <span className="min-w-0 flex-1">
              <span
                className="block truncate text-sm text-zinc-700 dark:text-zinc-300"
                title={doc.fileName}
              >
                {doc.fileName}
              </span>
              {doc.status === "processing" && (
                <span className="block text-xs text-zinc-400">
                  Checking and indexing…
                </span>
              )}
              {(doc.status === "rejected" || doc.status === "failed") && (
                <span
                  className="line-clamp-2 text-xs text-red-600 dark:text-red-400"
                  title={doc.error ?? undefined}
                >
                  {doc.status === "rejected" ? "Rejected" : "Failed"}:{" "}
                  {doc.error}
                </span>
              )}
            </span>

            {onDelete && (
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setPendingDelete(doc);
                }}
                disabled={deleting}
                aria-label={`Delete ${doc.fileName}`}
                title="Delete"
                // always shown for rejected / failed ones, which are only kept
                // so the admin can read why; and on phones, which can't hover
                className={`shrink-0 rounded p-1 text-zinc-400 transition ${
                  doc.status === "rejected" || doc.status === "failed"
                    ? ""
                    : "md:opacity-0 md:group-hover:opacity-100"
                } hover:bg-red-100 hover:text-red-600 focus-visible:opacity-100 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-red-950 dark:hover:text-red-400`}
              >
                <TrashIcon className="size-3.5" />
              </button>
            )}
          </li>
        ))}
      </ul>

      {upload && <div className="p-3">{upload}</div>}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete document?"
        description={`"${pendingDelete?.fileName ?? ""}" will be removed from search for everyone. This can't be undone.`}
        confirmLabel="Delete"
        busy={deleting}
        error={error}
        onConfirm={confirmDelete}
        onCancel={closeDialog}
      />
    </section>
  );
}

export default DocumentList;
