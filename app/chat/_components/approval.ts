import type { Approval, Message } from "./types";

// A pending approval as /api/chat streams it (the approval event), and as
// GET /api/conversations returns it to restore the card after a reload
export type ApprovalEvent = {
  threadId: string;
  message: string;
  toolCall: { name: string; args: Record<string, unknown> };
};

// The same words /api/chat saves to the conversation for a paused run, so
// the chat reads the same before and after a reload
export function pendingApprovalText(event: ApprovalEvent) {
  const days = event.toolCall.args.days;

  if (event.toolCall.name === "applyLeave" && typeof days === "number") {
    const dayLabel = days === 1 ? "day" : "days";

    return `I've prepared a leave application for ${days} ${dayLabel}. It is waiting for your approval before anything is submitted.`;
  }

  return event.message;
}

// The Approve / Reject card for an /api/chat pause
export function toApproval(event: ApprovalEvent): Approval {
  const days = event.toolCall.args.days;

  return {
    threadId: event.threadId,
    message: event.message,
    toolName: event.toolCall.name,
    days: typeof days === "number" ? days : undefined,
    status: "pending",
  };
}

// Puts a still-pending approval's card back on the saved "waiting for your
// approval" message (the latest one, if there are several), or adds that
// message if it isn't there
export function withPendingApproval(
  messages: Message[],
  pending: ApprovalEvent | null | undefined,
): Message[] {
  if (!pending) {
    return messages;
  }

  const text = pendingApprovalText(pending);
  const index = messages.findLastIndex(
    (message) => message.role === "ai" && message.text === text,
  );

  if (index === -1) {
    return [...messages, { role: "ai", text, approval: toApproval(pending) }];
  }

  return messages.map((message, i) =>
    i === index ? { ...message, approval: toApproval(pending) } : message,
  );
}
