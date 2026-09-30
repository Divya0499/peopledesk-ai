// A PDF chunk the answer was based on, sent by /api/chat after the text
export type Source = {
  id: string;
  text: string;
  source: string;
  chunkIndex: number;
  score?: number;
};

export type Message = {
  role: "user" | "ai" | "error";
  text: string;
  // The chunks an AI answer was based on
  sources?: Source[];
};

// An uploaded PDF, as returned by GET /api/documents
export type DocumentOption = {
  id: string;
  fileName: string;
  chunkCount: number;
};

// A saved chat, as returned by GET /api/conversations
export type ConversationSummary = {
  id: string;
  title: string | null;
  messages: {
    role: "user" | "ai";
    text: string;
    // Saved with each AI answer; null for user messages
    sources: Source[] | null;
  }[];
};
