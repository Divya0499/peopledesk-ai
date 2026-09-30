"use client";
import { useState } from "react";
import type { DocumentOption } from "./types";

type DocumentListProps = {
  documents: DocumentOption[];
  // Resolves once the document is gone; rejects with the server's error
  onDelete: (documentId: string) => Promise<void>;
};

// Uploaded PDFs, each with a button to delete it
function DocumentList({ documents, onDelete }: DocumentListProps) {
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
      <h2 className="px-4 pt-3 pb-2 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
        Documents
      </h2>

      <ul className="max-h-48 overflow-y-auto px-2 pb-3">
        {documents.length === 0 && (
          <li className="px-2 py-1.5 text-sm text-zinc-400">
            No documents uploaded
          </li>
        )}

        {documents.map((doc) => (
          <li
            key={doc.id}
            className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <span aria-hidden>📄</span>
            <span className="min-w-0 flex-1 truncate text-sm text-zinc-700 dark:text-zinc-300">
              {doc.fileName}
            </span>

            <button
              type="button"
              onClick={() => handleDelete(doc)}
              disabled={deletingId !== null}
              aria-label={`Delete ${doc.fileName}`}
              className="shrink-0 rounded px-1.5 py-0.5 text-xs text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-red-950 dark:hover:text-red-400"
            >
              {deletingId === doc.id ? "Deleting…" : "Delete"}
            </button>
          </li>
        ))}
      </ul>

      {error && <p className="px-4 pb-3 text-xs text-red-600">{error}</p>}
    </section>
  );
}

export default DocumentList;
