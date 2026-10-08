import type { ApprovalEvent } from "./approval";

// A PDF chunk the answer was based on, sent by /api/chat after the text
export type Source = {
  id: string;
  text: string;
  source: string;
  chunkIndex: number;
  score?: number;
};

// An action a run paused on, waiting for the person to approve or reject
// it, from /api/chat's approval event
export type Approval = {
  // Sent back to /api/chat/resume to continue the paused run
  threadId: string;
  message: string;
  // The tool waiting to run, e.g. applyLeave
  toolName: string;
  // applyLeave's number of days; no userId, the server knows who's asking
  days?: number;
  status: "pending" | "approved" | "rejected";
};

export type Message = {
  role: "user" | "ai" | "error";
  text: string;
  // The chunks an AI answer was based on
  sources?: Source[];
  approval?: Approval;
};

// An uploaded PDF, as returned by GET /api/documents. Employees only get
// ready ones; admins also see uploads still processing or that didn't make it.
export type DocumentOption = {
  id: string;
  fileName: string;
  chunkCount: number;
  status: "processing" | "ready" | "rejected" | "failed";
  // Why it was rejected or failed
  error: string | null;
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
  // A leave application in this chat still waiting for approval, so its
  // card can be shown again; null when there's none
  pendingApproval: ApprovalEvent | null;
};
