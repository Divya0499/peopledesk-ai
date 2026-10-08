"use client";

import { useState } from "react";

import { dayLabel, formatDate } from "./format";
import StatusBadge from "./StatusBadge";
import type { LeaveRequest } from "./types";

type MyRequestsProps = {
  requests: LeaveRequest[];
  onChanged: () => void;
};

// The employee's own requests, with Cancel on the pending ones
function MyRequests({ requests, onChanged }: MyRequestsProps) {
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  async function cancel(id: string) {
    setBusyId(id);
    setError("");

    try {
      const response = await fetch(`/api/leave/${id}/cancel`, {
        method: "POST",
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error ?? `Server error: ${response.status}`);
      }

      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel");
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="border-b border-zinc-100 px-5 py-4 font-medium text-zinc-900 dark:border-zinc-800 dark:text-zinc-50">
        My requests
      </h2>

      {error && (
        <p
          role="alert"
          className="px-5 pt-3 text-sm text-red-600 dark:text-red-400"
        >
          {error}
        </p>
      )}

      {requests.length === 0 ? (
        <p className="px-5 py-6 text-sm text-zinc-500">
          No leave requests yet. Use the form above, or ask the assistant.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {requests.map((request) => (
            <li
              key={request.id}
              className="flex flex-wrap items-start gap-x-4 gap-y-2 px-5 py-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-zinc-900 dark:text-zinc-50">
                    {dayLabel(request.days)}
                  </span>
                  <StatusBadge status={request.status} />
                </div>
                <p className="mt-1 text-sm text-zinc-500">
                  Requested {formatDate(request.createdAt)}
                  {request.reason && ` · ${request.reason}`}
                </p>
                {request.decidedBy && (
                  <p className="mt-1 text-sm text-zinc-500">
                    {request.status === "approved" ? "Approved" : "Rejected"} by{" "}
                    {request.decidedBy.name}
                    {request.decisionNote && `: “${request.decisionNote}”`}
                  </p>
                )}
              </div>

              {request.status === "pending" && (
                <button
                  type="button"
                  onClick={() => cancel(request.id)}
                  disabled={busyId !== ""}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  {busyId === request.id ? "Cancelling…" : "Cancel"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default MyRequests;
