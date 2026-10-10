// shown by the server and checked first in the leave page, so they match
export const REJECT_REASON_REQUIRED =
  "Add a reason so the employee knows why their leave was rejected.";

// used by the server and the UI (to find the message after reload), keep it in one place
export function leaveConfirmText(days: number) {
  const dayLabel = days === 1 ? "day" : "days";

  return `I've prepared a leave request for ${days} ${dayLabel}. Confirm it below to send it to your manager for approval.`;
}
