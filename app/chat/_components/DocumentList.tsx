"use client";
import { useState, type ReactNode } from "react";
import ConfirmDialog from "./ConfirmDialog";
import { FileIcon, TrashIcon } from "./icons";
import type { DocumentOption } from "./types";

type DocumentListProps = {
  documents: DocumentOption[];
  // Resolves once the document is gone; rejects with the server's error.
  // Omitted for users who may not delete, which hides the delete buttons
  onDelete?: (documentId: string) => Promise<void>;
  // Shown under the heading, e.g. the upload button
  upload?: ReactNode;
};

// Uploaded PDFs, each with a button to delete it when onDelete is given
function DocumentList({ documents, onDelete, upload }: DocumentListProps) {
  // The document the confirmation dialog is asking about; null when closed
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
      // Kept open with the error, so the person can retry or cancel
      setError(
        err instanceof Error ? err.message : "Failed to delete document",
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="border-t border-zinc-200 dark:border-zinc-800">
      <h2 className="flex items-center justify-between px-4 pt-3 pb-1.5 text-xs font-medium text-zinc-500">
        Documents
        {documents.length > 0 && (
          <span className="rounded-full bg-zinc-200 px-1.5 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            {documents.length}
          </span>
        )}
      </h2>

      <ul className="max-h-48 overflow-y-auto px-3">
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
            <FileIcon className="size-4 shrink-0 text-indigo-500" />
            <span
              className="min-w-0 flex-1 truncate text-sm text-zinc-700 dark:text-zinc-300"
              title={doc.fileName}
            >
              {doc.fileName}
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
                className="shrink-0 rounded p-1 text-zinc-400 opacity-0 transition group-hover:opacity-100 hover:bg-red-100 hover:text-red-600 focus-visible:opacity-100 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-red-950 dark:hover:text-red-400"
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
