"use client";

import { useRef, useState } from "react";
import { UploadIcon } from "./icons";

// One picked file's progress. Each file is its own /api/upload request, so
// one bad PDF fails on its own and the rest still upload.
type FileStatus =
  | { fileName: string; type: "waiting" | "uploading" }
  | { fileName: string; type: "success"; chunks: number; replaced: boolean }
  | { fileName: string; type: "error"; message: string };

type PdfUploadProps = {
  // Called after each file that uploads, so the list updates as they finish
  onUploaded: () => void;
};

async function uploadFile(file: File) {
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

  return data as { chunks: number; replaced: boolean };
}

export default function PdfUpload({ onUploaded }: PdfUploadProps) {
  const [files, setFiles] = useState<FileStatus[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploading = files.some(
    (file) => file.type === "waiting" || file.type === "uploading",
  );

  const setFileStatus = (index: number, status: FileStatus) =>
    setFiles((prev) => prev.map((file, i) => (i === index ? status : file)));

  // One at a time rather than all at once: every chunk of every file is
  // embedded by the API, and parallel uploads hit its rate limit sooner
  const uploadFiles = async (picked: File[]) => {
    setFiles(picked.map((file) => ({ fileName: file.name, type: "waiting" })));

    for (const [index, file] of picked.entries()) {
      setFileStatus(index, { fileName: file.name, type: "uploading" });

      try {
        const { chunks, replaced } = await uploadFile(file);

        setFileStatus(index, {
          fileName: file.name,
          type: "success",
          chunks,
          replaced,
        });
        onUploaded();
      } catch (error) {
        setFileStatus(index, {
          fileName: file.name,
          type: "error",
          message: error instanceof Error ? error.message : "Upload failed",
        });
      }
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Hidden file input, opened by the button */}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        className="hidden"
        onChange={(event) => {
          const picked = Array.from(event.target.files ?? []);

          // Clear the input so the same files can be picked again
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

      {/* One status line per picked file */}
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
                  Processing {file.fileName}
                </p>
              )}

              {file.type === "success" && (
                <p className="truncate text-emerald-600 dark:text-emerald-400">
                  ✓ {file.fileName} ({file.chunks} chunks
                  {file.replaced ? ", replaced old version" : ""})
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
