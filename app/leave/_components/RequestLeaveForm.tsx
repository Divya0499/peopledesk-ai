"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import {
  CalendarIcon,
  MinusIcon,
  PlusIcon,
} from "@/app/chat/_components/icons";

type RequestLeaveFormProps = {
  available: number;
};

// One click fills the reason; the person can still type their own
const QUICK_REASONS = ["Vacation", "Feeling unwell", "Family event", "Personal"];

const stepButtonClass =
  "grid size-10 shrink-0 place-items-center text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-zinc-800 dark:hover:text-zinc-100";

// The non-chat way to request leave: the same rules as asking the assistant
function RequestLeaveForm({ available }: RequestLeaveFormProps) {
  const router = useRouter();
  const [days, setDays] = useState("1");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  // One key per request, kept across retries of it (a timeout, a double
  // click) and replaced once it succeeds, so it reserves the days only once
  const idempotencyKey = useRef(crypto.randomUUID());

  const max = Math.max(1, available);
  const dayCount = Number(days) || 0;
  const left = available - dayCount;

  const step = (by: number) =>
    setDays(String(Math.min(max, Math.max(1, dayCount + by))));

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSubmitting(true);

    try {
      const response = await fetch("/api/leave", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey.current,
        },
        body: JSON.stringify({
          days: Number(days),
          reason: reason.trim() || undefined,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error ?? `Server error: ${response.status}`);
      }

      idempotencyKey.current = crypto.randomUUID();
      setMessage(data.message);
      setDays("1");
      setReason("");
      // reloads the page's server data; this component keeps its state
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="flex items-start gap-3 border-b border-zinc-100 p-5 dark:border-zinc-800">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm shadow-indigo-500/25">
          <CalendarIcon className="size-5" />
        </span>
        <div>
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">
            Request leave
          </h2>
          <p className="mt-0.5 text-sm text-zinc-500">
            Sent to your manager. The days are reserved until they decide.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-5 p-5">
        <div>
          <label
            htmlFor="leave-days"
            className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Days
          </label>
          <div className="mt-1.5 flex items-center overflow-hidden rounded-xl border border-zinc-200 transition focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-500/10 dark:border-zinc-700">
            <button
              type="button"
              onClick={() => step(-1)}
              disabled={dayCount <= 1}
              aria-label="Decrease"
              className={stepButtonClass}
            >
              <MinusIcon className="size-4" />
            </button>
            <input
              id="leave-days"
              type="number"
              min={1}
              max={max}
              step={1}
              required
              value={days}
              onChange={(event) => setDays(event.target.value)}
              className="w-full min-w-0 border-x border-zinc-200 bg-transparent py-2 text-center text-lg font-semibold tabular-nums text-zinc-900 outline-none [appearance:textfield] dark:border-zinc-700 dark:text-zinc-50 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <button
              type="button"
              onClick={() => step(1)}
              disabled={dayCount >= max}
              aria-label="Increase"
              className={stepButtonClass}
            >
              <PlusIcon className="size-4" />
            </button>
          </div>
          <p className="mt-1.5 text-xs text-zinc-500">
            {available < 1
              ? "No leave days left to request."
              : left >= 0
                ? `${left} of ${available} ${available === 1 ? "day" : "days"} left after this request`
                : `Only ${available} ${available === 1 ? "day" : "days"} available`}
          </p>
        </div>

        <div>
          <label
            htmlFor="leave-reason"
            className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Reason <span className="font-normal text-zinc-400">(optional)</span>
          </label>
          <textarea
            id="leave-reason"
            rows={2}
            value={reason}
            maxLength={500}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. Family wedding"
            className="mt-1.5 block w-full resize-none rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {QUICK_REASONS.map((quick) => (
              <button
                key={quick}
                type="button"
                onClick={() => setReason(quick)}
                aria-pressed={reason === quick}
                className="rounded-full border border-zinc-200 px-2.5 py-1 text-xs text-zinc-600 transition hover:border-indigo-300 hover:text-indigo-700 aria-pressed:border-indigo-400 aria-pressed:bg-indigo-50 aria-pressed:text-indigo-700 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-indigo-700 dark:hover:text-indigo-300 dark:aria-pressed:bg-indigo-950/50 dark:aria-pressed:text-indigo-300"
              >
                {quick}
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting || available < 1}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-medium text-white shadow-md shadow-indigo-500/20 transition hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting && (
            <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          )}
          {submitting ? "Sending…" : "Send request"}
        </button>

        {message && (
          <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
            {message}
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-400"
          >
            {error}
          </p>
        )}
      </div>
    </form>
  );
}

export default RequestLeaveForm;
