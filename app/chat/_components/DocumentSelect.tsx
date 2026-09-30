import { FileIcon } from "./icons";
import type { DocumentOption } from "./types";

type DocumentSelectProps = {
  documents: DocumentOption[];
  // "" means search all documents
  value: string;
  onChange: (documentId: string) => void;
  disabled: boolean;
};

function DocumentSelect({
  documents,
  value,
  onChange,
  disabled,
}: DocumentSelectProps) {
  return (
    <div className="relative flex items-center">
      <label htmlFor="document-select" className="sr-only">
        Search in
      </label>

      <FileIcon className="pointer-events-none absolute left-2.5 size-3.5 text-zinc-500" />

      <select
        id="document-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="max-w-56 cursor-pointer truncate rounded-lg bg-zinc-100 py-1.5 pr-3 pl-7 text-xs font-medium text-zinc-700 outline-none hover:bg-zinc-200 focus-visible:ring-2 focus-visible:ring-indigo-500/40 disabled:cursor-not-allowed disabled:opacity-50 sm:max-w-72 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:[&>option]:bg-zinc-900"
      >
        <option value="">All documents</option>

        {documents.map((doc) => (
          <option key={doc.id} value={doc.id}>
            {doc.fileName} ({doc.chunkCount} chunks)
          </option>
        ))}
      </select>
    </div>
  );
}

export default DocumentSelect;
