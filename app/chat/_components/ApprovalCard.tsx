import { CalendarIcon } from "./icons";
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
    <div className="max-w-md rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50/60 p-4 text-sm shadow-sm dark:border-amber-900 dark:from-amber-950/40 dark:to-amber-950/10">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
          <CalendarIcon className="size-4.5" />
        </span>
        <div className="min-w-0">
          <p className="font-medium text-zinc-900 dark:text-zinc-50">
            {isLeave
              ? `Leave request: ${approval.days} ${dayLabel}`
              : approval.message}
          </p>
          <p className="mt-0.5 text-zinc-600 dark:text-zinc-400">
            {isLeave
              ? "Sent to your manager only after you confirm."
              : "Nothing happens until you confirm."}
          </p>
        </div>
      </div>

      {approval.status === "pending" ? (
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => onDecision(true)}
            disabled={disabled}
            className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Confirm
          </button>
          <button
            type="button"
            onClick={() => onDecision(false)}
            disabled={disabled}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
        </div>
      ) : (
        <p
          className={`mt-3 flex items-center gap-1.5 font-medium ${
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
