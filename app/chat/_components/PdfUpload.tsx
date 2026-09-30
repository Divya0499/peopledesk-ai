"use client";

import { useRef, useState } from "react";
import { UploadIcon } from "./icons";

type Status =
  | { type: "idle" }
  | { type: "uploading"; fileName: string }
  | { type: "success"; fileName: string; chunks: number }
  | { type: "error"; message: string };

type PdfUploadProps = {
  // Called with the new document's ID after a successful upload
  onUploaded: (documentId: string) => void;
};

export default function PdfUpload({ onUploaded }: PdfUploadProps) {
  const [status, setStatus] = useState<Status>({ type: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File) => {
    setStatus({ type: "uploading", fileName: file.name });

    try {
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

      setStatus({
        type: "success",
        fileName: data.fileName,
        chunks: data.chunks,
      });

      onUploaded(data.documentId);
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Upload failed",
      });
    } finally {
      // Clear the input so the same file can be picked again
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  const uploading = status.type === "uploading";

  return (
    <div className="flex flex-col gap-2">
      {/* Hidden file input, opened by the button */}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];

          if (file) {
            uploadFile(file);
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
        {uploading ? "Uploading..." : "Upload PDF"}
      </button>

      {/* Status message */}
      {status.type === "uploading" && (
        <p className="truncate text-xs text-zinc-500" title={status.fileName}>
          Processing {status.fileName}
        </p>
      )}

      {status.type === "success" && (
        <p
          className="truncate text-xs text-emerald-600 dark:text-emerald-400"
          title={status.fileName}
        >
          ✓ {status.fileName} ({status.chunks} chunks)
        </p>
      )}

      {status.type === "error" && (
        <p className="text-xs text-red-600 dark:text-red-400">
          {status.message}
        </p>
      )}
    </div>
  );
}
