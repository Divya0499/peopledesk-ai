// used by the server and the UI (to find the message after reload), keep it in one place
export function leaveConfirmText(days: number) {
  const dayLabel = days === 1 ? "day" : "days";

  return `I've prepared a leave request for ${days} ${dayLabel}. Confirm it below to send it to your manager for approval.`;
}
