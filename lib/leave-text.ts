// What the assistant says when a run pauses for the employee to confirm a
// leave request. Shared by /api/chat, which saves it to the conversation,
// and the chat UI, which finds that saved message again after a reload to
// put the confirm card back, so the two must never differ.
export function leaveConfirmText(days: number) {
  const dayLabel = days === 1 ? "day" : "days";

  return `I've prepared a leave request for ${days} ${dayLabel}. Confirm it below to send it to your manager for approval.`;
}
