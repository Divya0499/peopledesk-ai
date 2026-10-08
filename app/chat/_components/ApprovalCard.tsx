import type { Approval } from "./types";

type ApprovalCardProps = {
  approval: Approval;
  // True while any request is running, so the run can't be resumed twice
  disabled: boolean;
  onDecision: (approved: boolean) => void;
};

// The action a run paused on. Nothing is written to the database until the
// person confirms; a leave request then goes to their manager.
function ApprovalCard({ approval, disabled, onDecision }: ApprovalCardProps) {
  const isLeave =
    approval.toolName === "applyLeave" && typeof approval.days === "number";
  const dayLabel = approval.days === 1 ? "day" : "days";

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900 dark:bg-amber-950/30">
      <p className="font-medium text-zinc-900 dark:text-zinc-50">
        {isLeave
          ? `Leave request: ${approval.days} ${dayLabel}`
          : approval.message}
      </p>
      <p className="mt-1 text-zinc-600 dark:text-zinc-400">
        {isLeave
          ? "Sent to your manager only after you confirm."
          : "Nothing happens until you confirm."}
      </p>

      {approval.status === "pending" ? (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => onDecision(true)}
            disabled={disabled}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Confirm
          </button>
          <button
            type="button"
            onClick={() => onDecision(false)}
            disabled={disabled}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
        </div>
      ) : (
        <p
          className={`mt-3 font-medium ${
            approval.status === "approved"
              ? "text-green-700 dark:text-green-400"
              : "text-red-700 dark:text-red-400"
          }`}
        >
          {approval.status === "approved"
            ? isLeave
              ? "Sent for manager approval"
              : "Confirmed"
            : "Cancelled"}
        </p>
      )}
    </div>
  );
}

export default ApprovalCard;
