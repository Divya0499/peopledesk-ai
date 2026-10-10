import type { ApprovalEvent } from "./approval";

export type Source = {
  id: string;
  text: string;
  source: string;
  chunkIndex: number;
  score?: number;
};

export type Approval = {
  threadId: string;
  message: string;
  toolName: string;
  days?: number;
  status: "pending" | "approved" | "rejected";
};

export type Message = {
  role: "user" | "ai" | "error";
  text: string;
  sources?: Source[];
  approval?: Approval;
};

export type DocumentOption = {
  id: string;
  fileName: string;
  chunkCount: number;
  status: "processing" | "ready" | "rejected" | "failed";
  error: string | null;
};

// what the sidebar lists
export type ConversationSummary = {
  id: string;
  title: string | null;
};

// an opened conversation
export type ConversationDetail = ConversationSummary & {
  messages: {
    role: "user" | "ai";
    text: string;
    sources: Source[] | null;
  }[];
  pendingApproval: ApprovalEvent | null;
};
