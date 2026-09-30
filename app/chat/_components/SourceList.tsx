"use client";
import { useState } from "react";
import { CloseIcon, FileIcon } from "./icons";
import type { Source } from "./types";

type SourceListProps = {
  sources: Source[];
};

// The chunks an answer was based on; click one to read its text
function SourceList({ sources }: SourceListProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = sources.find((source) => source.id === selectedId);

  return (
    <div className="w-full">
      <p className="mb-2 text-xs font-medium text-zinc-500">
        {sources.length} {sources.length === 1 ? "source" : "sources"}
      </p>

      <ul className="flex flex-wrap gap-1.5">
        {sources.map((source, i) => (
          <li key={source.id} className="min-w-0">
            <button
              type="button"
              // Clicking the open source again closes it
              onClick={() =>
                setSelectedId(source.id === selectedId ? null : source.id)
              }
              aria-expanded={source.id === selectedId}
              title={`${source.source}, chunk ${source.chunkIndex}`}
              className="flex max-w-64 items-center gap-1.5 rounded-full border border-zinc-200 bg-white py-1 pr-3 pl-1 text-xs text-zinc-600 transition hover:border-zinc-300 hover:bg-zinc-50 aria-expanded:border-indigo-300 aria-expanded:bg-indigo-50 aria-expanded:text-indigo-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:aria-expanded:border-indigo-700 dark:aria-expanded:bg-indigo-950/50 dark:aria-expanded:text-indigo-300"
            >
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-zinc-100 text-[10px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                {i + 1}
              </span>
              <span className="truncate">{source.source}</span>
              <span className="shrink-0 text-zinc-400">
                #{source.chunkIndex}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {selected && (
        <div className="mt-3 rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between gap-4 border-b border-zinc-100 px-4 py-2.5 dark:border-zinc-800">
            <div className="flex min-w-0 items-center gap-2">
              <FileIcon className="size-4 shrink-0 text-indigo-500" />
              <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                {selected.source}
              </p>
              <span className="shrink-0 text-xs text-zinc-500">
                Chunk {selected.chunkIndex}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setSelectedId(null)}
              aria-label="Close source"
              className="shrink-0 rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
            >
              <CloseIcon className="size-4" />
            </button>
          </div>

          {/* Long chunks scroll inside the panel instead of stretching the chat */}
          <p className="max-h-72 overflow-y-auto px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
            {selected.text}
          </p>
        </div>
      )}
    </div>
  );
}

export default SourceList;
