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
    <div className="mx-auto flex w-full max-w-3xl items-center gap-2">
      <label
        htmlFor="document-select"
        className="shrink-0 text-sm text-zinc-500"
      >
        Search in
      </label>

      <select
        id="document-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="min-w-0 flex-1 truncate rounded-lg border border-zinc-300 bg-transparent px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none sm:w-72 dark:border-zinc-700 dark:text-zinc-50 dark:[&>option]:bg-zinc-900"
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
