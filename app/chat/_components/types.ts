export type Message = {
  role: "user" | "ai" | "error";
  text: string;
};

// An uploaded PDF, as returned by GET /api/documents
export type DocumentOption = {
  id: string;
  fileName: string;
  chunkCount: number;
};
