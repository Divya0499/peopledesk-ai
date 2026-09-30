"use client";
import { useState, type ReactNode } from "react";
import { FileIcon, TrashIcon } from "./icons";
import type { DocumentOption } from "./types";

type DocumentListProps = {
  documents: DocumentOption[];
  // Resolves once the document is gone; rejects with the server's error
  onDelete: (documentId: string) => Promise<void>;
  // Shown under the heading, e.g. the upload button
  upload?: ReactNode;
};

// Uploaded PDFs, each with a button to delete it
function DocumentList({ documents, onDelete, upload }: DocumentListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const handleDelete = async (doc: DocumentOption) => {
    const confirmed = window.confirm(
      `Delete "${doc.fileName}"? Its chunks will be removed from search. This can't be undone.`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(doc.id);
    setError("");

    try {
      await onDelete(doc.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete document");
    } finally {
      setDeletingId(null);
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

            <button
              type="button"
              onClick={() => handleDelete(doc)}
              disabled={deletingId !== null}
              aria-label={`Delete ${doc.fileName}`}
              title="Delete"
              className="shrink-0 rounded p-1 text-zinc-400 opacity-0 transition group-hover:opacity-100 hover:bg-red-100 hover:text-red-600 focus-visible:opacity-100 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-red-950 dark:hover:text-red-400"
            >
              {deletingId === doc.id ? (
                <span className="text-xs">…</span>
              ) : (
                <TrashIcon className="size-3.5" />
              )}
            </button>
          </li>
        ))}
      </ul>

      {error && <p className="px-4 pt-1 text-xs text-red-600">{error}</p>}

      {upload && <div className="p-3">{upload}</div>}
    </section>
  );
}

export default DocumentList;
