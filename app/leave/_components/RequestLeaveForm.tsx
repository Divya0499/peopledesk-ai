"use client";

import { useRef, useState } from "react";

type RequestLeaveFormProps = {
  available: number;
  // Called after a request is sent, so the page reloads its data
  onRequested: () => void;
};

const inputClass =
  "mt-1.5 block w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50";

// The non-chat way to request leave: the same rules as asking the assistant
function RequestLeaveForm({ available, onRequested }: RequestLeaveFormProps) {
  const [days, setDays] = useState("1");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  // One key per request, kept across retries of it (a timeout, a double
  // click) and replaced once it succeeds, so it reserves the days only once
  const idempotencyKey = useRef(crypto.randomUUID());

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
      onRequested();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <h2 className="font-medium text-zinc-900 dark:text-zinc-50">
        Request leave
      </h2>
      <p className="mt-1 text-sm text-zinc-500">
        Sent to your manager. The days are reserved until they decide.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-[8rem_1fr]">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Days
          <input
            type="number"
            min={1}
            max={Math.max(1, available)}
            step={1}
            required
            value={days}
            onChange={(event) => setDays(event.target.value)}
            className={inputClass}
          />
        </label>

        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Reason <span className="font-normal text-zinc-400">(optional)</span>
          <input
            value={reason}
            maxLength={500}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. Family wedding"
            className={inputClass}
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={submitting || available < 1}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Sending…" : "Send request"}
        </button>
        {available < 1 && (
          <span className="text-sm text-zinc-500">
            No leave days left to request.
          </span>
        )}
      </div>

      {message && (
        <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-400">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </form>
  );
}

export default RequestLeaveForm;
