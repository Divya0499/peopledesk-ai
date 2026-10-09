import { leaveConfirmText } from "@/lib/leave-text";
import type { Approval, Message } from "./types";

export type ApprovalEvent = {
  threadId: string;
  message: string;
  toolCall: { name: string; args: Record<string, unknown> };
};

// same text the server saves, so it looks the same after a reload
export function pendingApprovalText(event: ApprovalEvent) {
  const days = event.toolCall.args.days;

  if (event.toolCall.name === "applyLeave" && typeof days === "number") {
    return leaveConfirmText(days);
  }

  return event.message;
}

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

// put the card back on the last "waiting for approval" message after a reload
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
