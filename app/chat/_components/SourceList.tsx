"use client";
import { useState } from "react";
import type { Source } from "./types";

type SourceListProps = {
  sources: Source[];
};

// The chunks an answer was based on; click one to read its text
function SourceList({ sources }: SourceListProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = sources.find((source) => source.id === selectedId);

  return (
    <div className="w-full px-1">
      <p className="mb-2 border-b border-zinc-200 pb-1 text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:border-zinc-800">
        Sources
      </p>

      <ul className="flex max-w-md flex-col gap-1">
        {sources.map((source) => (
          <li key={source.id}>
            <button
              type="button"
              // Clicking the open source again closes it
              onClick={() =>
                setSelectedId(source.id === selectedId ? null : source.id)
              }
              aria-expanded={source.id === selectedId}
              className="flex w-full gap-2 rounded-lg px-2 py-1 text-left text-sm hover:bg-zinc-100 aria-expanded:bg-zinc-100 dark:hover:bg-zinc-800 dark:aria-expanded:bg-zinc-800"
            >
              <span aria-hidden>📄</span>
              <span className="min-w-0">
                <span className="block truncate text-zinc-700 dark:text-zinc-300">
                  {source.source}
                </span>
                <span className="block text-xs text-zinc-400">
                  Chunk {source.chunkIndex}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {selected && (
        <div className="mt-2 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-2 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                {selected.source}
              </p>
              <p className="text-xs text-zinc-500">
                Chunk {selected.chunkIndex}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="shrink-0 rounded-lg px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
            >
              Close
            </button>
          </div>

          {/* Long chunks scroll inside the panel instead of stretching the chat */}
          <p className="max-h-72 overflow-y-auto text-sm whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
            {selected.text}
          </p>
        </div>
      )}
    </div>
  );
}

export default SourceList;
