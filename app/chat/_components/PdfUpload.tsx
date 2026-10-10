"use client";

import { useRef, useState } from "react";
import { UploadIcon } from "./icons";
import type { DocumentOption } from "./types";

type FileStatus =
  | { fileName: string; type: "waiting" | "uploading" | "sent" }
  | { fileName: string; type: "error"; message: string };

type PdfUploadProps = {
  // gets the new document (status "processing") from the upload response
  onUploaded: (document: DocumentOption) => void;
};

async function uploadFile(file: File): Promise<DocumentOption> {
  const formData = new FormData();

  formData.append("file", file);

  const response = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? `Server error: ${response.status}`);
  }

  return data.document;
}

// "sent" lines go away after this; the document list shows each file's
// status from then on, and the sidebar keeps room for the chats
const SENT_VISIBLE_MS = 4000;

export default function PdfUpload({ onUploaded }: PdfUploadProps) {
  const [files, setFiles] = useState<FileStatus[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploading = files.some(
    (file) => file.type === "waiting" || file.type === "uploading",
  );

  const setFileStatus = (index: number, status: FileStatus) =>
    setFiles((prev) => prev.map((file, i) => (i === index ? status : file)));

  // one request per file so one bad file doesn't fail the rest
  const uploadFiles = async (picked: File[]) => {
    setFiles(picked.map((file) => ({ fileName: file.name, type: "waiting" })));

    for (const [index, file] of picked.entries()) {
      setFileStatus(index, { fileName: file.name, type: "uploading" });

      try {
        const uploaded = await uploadFile(file);

        setFileStatus(index, { fileName: file.name, type: "sent" });
        onUploaded(uploaded);
      } catch (error) {
        setFileStatus(index, {
          fileName: file.name,
          type: "error",
          message: error instanceof Error ? error.message : "Upload failed",
        });
      }
    }

    // errors stay until the next upload, so they can still be read
    setTimeout(
      () => setFiles((prev) => prev.filter((file) => file.type !== "sent")),
      SENT_VISIBLE_MS,
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        className="hidden"
        onChange={(event) => {
          const picked = Array.from(event.target.files ?? []);

          // reset so you can pick the same file again
          event.target.value = "";

          if (picked.length > 0) {
            uploadFiles(picked);
          }
        }}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-600 transition hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-indigo-500 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300"
      >
        {uploading ? (
          <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          <UploadIcon className="size-4" />
        )}
        {uploading ? "Uploading..." : "Upload PDFs"}
      </button>

      <p className="text-[11px] text-zinc-400">
        HR and company policy PDFs only, up to 10 MB, with selectable text.
      </p>

      {files.length > 0 && (
        <ul className="flex max-h-32 flex-col gap-1 overflow-y-auto text-xs">
          {files.map((file, i) => (
            <li key={`${file.fileName}-${i}`} title={file.fileName}>
              {file.type === "waiting" && (
                <p className="truncate text-zinc-400">
                  Waiting: {file.fileName}
                </p>
              )}

              {file.type === "uploading" && (
                <p className="truncate text-zinc-500">
                  Sending {file.fileName}
                </p>
              )}

              {file.type === "sent" && (
                <p className="truncate text-emerald-600 dark:text-emerald-400">
                  ✓ {file.fileName} sent
                </p>
              )}

              {file.type === "error" && (
                <p className="text-red-600 dark:text-red-400">
                  <span className="block truncate">✗ {file.fileName}</span>
                  {file.message}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
