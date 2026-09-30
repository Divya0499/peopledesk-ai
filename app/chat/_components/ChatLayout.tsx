"use client";
import { useEffect, useState } from "react";
import ChatWindow from "./ChatWindow";
import PdfUpload from "./PdfUpload";
import type { DocumentOption } from "./types";

async function fetchDocuments(): Promise<DocumentOption[]> {
  const response = await fetch("/api/documents");
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? `Server error: ${response.status}`);
  }

  return data.documents;
}

// Holds the document list so the upload button and the
// chat's document dropdown stay in sync
function ChatLayout() {
  const [documents, setDocuments] = useState<DocumentOption[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(true);
  // "" means search all documents
  const [documentId, setDocumentId] = useState("");

  useEffect(() => {
    fetchDocuments()
      .then(setDocuments)
      // The chat still works without the list, it just searches everything
      .catch((error) => console.error("Could not load documents", error))
      .finally(() => setLoadingDocuments(false));
  }, []);

  // Show the new PDF in the dropdown and chat with it straight away
  const handleUploaded = async (uploadedId: string) => {
    try {
      setDocuments(await fetchDocuments());
      setDocumentId(uploadedId);
    } catch (error) {
      console.error("Could not load documents", error);
    }
  };

  return (
    <div className="flex h-dvh w-full flex-col bg-zinc-50 dark:bg-black">
      <header className="border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4">
          <h1 className="shrink-0 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            My AI App
          </h1>

          <PdfUpload onUploaded={handleUploaded} />
        </div>
      </header>

      <ChatWindow
        documents={documents}
        loadingDocuments={loadingDocuments}
        documentId={documentId}
        onDocumentChange={setDocumentId}
      />
    </div>
  );
}

export default ChatLayout;
