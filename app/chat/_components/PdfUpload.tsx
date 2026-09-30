"use client";

import { useRef, useState } from "react";

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
    <div className="flex min-w-0 items-center gap-3">
      {/* Status message */}
      {status.type === "uploading" && (
        <span className="truncate text-sm text-zinc-500">
          Uploading {status.fileName}...
        </span>
      )}

      {status.type === "success" && (
        <span
          className="truncate text-sm text-green-600 dark:text-green-400"
          title={status.fileName}
        >
          ✓ {status.fileName} ({status.chunks} chunks)
        </span>
      )}

      {status.type === "error" && (
        <span
          className="truncate text-sm text-red-600 dark:text-red-400"
          title={status.message}
        >
          {status.message}
        </span>
      )}

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
        className="shrink-0 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        {uploading ? "Uploading..." : "Upload PDF"}
      </button>
    </div>
  );
}
