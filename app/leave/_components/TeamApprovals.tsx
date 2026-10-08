"use client";

import { useState } from "react";

import { dayLabel, formatDate } from "./format";
import type { TeamRequest } from "./types";

type TeamApprovalsProps = {
  requests: TeamRequest[];
  onChanged: () => void;
};

// Requests from the manager's team waiting for a decision, oldest first
function TeamApprovals({ requests, onChanged }: TeamApprovalsProps) {
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  async function decide(id: string, approve: boolean) {
    setBusyId(id);
    setError("");

    try {
      const response = await fetch(`/api/leave/${id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approve,
          note: notes[id]?.trim() || undefined,
        }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error ?? `Server error: ${response.status}`);
      }

      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save decision");
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="flex items-center gap-2 border-b border-zinc-100 px-5 py-4 font-medium text-zinc-900 dark:border-zinc-800 dark:text-zinc-50">
        Waiting for your approval
        {requests.length > 0 && (
          <span className="rounded-full bg-amber-100 px-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            {requests.length}
          </span>
        )}
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
          Nothing waiting. New requests from your team appear here.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {requests.map((request) => (
            <li key={request.id} className="px-5 py-4">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-medium text-zinc-900 dark:text-zinc-50">
                  {request.employee.name}
                </span>
                <span className="text-sm text-zinc-500">
                  {request.employee.department}
                </span>
              </div>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {dayLabel(request.days)} · requested{" "}
                {formatDate(request.createdAt)}
                {request.reason && ` · “${request.reason}”`}
              </p>
              <p className="mt-0.5 text-xs text-zinc-400">
                {dayLabel(request.employee.leaveBalance)} left after this
                request
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  value={notes[request.id] ?? ""}
                  onChange={(event) =>
                    setNotes((prev) => ({
                      ...prev,
                      [request.id]: event.target.value,
                    }))
                  }
                  maxLength={500}
                  placeholder="Note (optional)"
                  aria-label={`Note for ${request.employee.name}`}
                  className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-indigo-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                />
                <button
                  type="button"
                  onClick={() => decide(request.id, true)}
                  disabled={busyId !== ""}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => decide(request.id, false)}
                  disabled={busyId !== ""}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default TeamApprovals;
