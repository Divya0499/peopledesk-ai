"use client";

import { useState } from "react";

import Avatar from "@/app/_components/Avatar";
import { CheckIcon, CloseIcon, UsersIcon } from "@/app/chat/_components/icons";
import { REJECT_REASON_REQUIRED } from "@/lib/leave-text";

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
  // the request whose Reject was clicked with no reason typed
  const [missingReasonId, setMissingReasonId] = useState("");

  async function decide(id: string, approve: boolean) {
    setError("");

    // the server refuses this too; checking here saves a round trip
    if (!approve && !notes[id]?.trim()) {
      setMissingReasonId(id);
      document.getElementById(`note-${id}`)?.focus();
      return;
    }

    setMissingReasonId("");
    setBusyId(id);

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
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-3 border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
        <span className="grid size-9 place-items-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
          <UsersIcon className="size-4.5" />
        </span>
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">
          Waiting for your approval
        </h2>
        {requests.length > 0 && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            {requests.length}
          </span>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="mx-5 mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-400"
        >
          {error}
        </p>
      )}

      {requests.length === 0 ? (
        <div className="flex items-center gap-3 px-5 py-5">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
            <CheckIcon className="size-4" />
          </span>
          <p className="text-sm text-zinc-500">
            Nothing waiting. New requests from your team appear here.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {requests.map((request) => (
            <li key={request.id} className="px-5 py-4">
              <div className="flex flex-wrap items-start gap-3">
                <Avatar name={request.employee.name} className="size-10 text-sm" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-zinc-900 dark:text-zinc-50">
                    {request.employee.name}
                  </p>
                  <p className="text-sm text-zinc-500">
                    {request.employee.department} · requested{" "}
                    {formatDate(request.createdAt)}
                  </p>
                </div>
                <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-sm font-semibold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                  {dayLabel(request.days)}
                </span>
              </div>

              {request.reason && (
                <p className="mt-3 rounded-xl bg-zinc-50 px-3 py-2 text-sm text-zinc-700 italic dark:bg-zinc-800/60 dark:text-zinc-300">
                  “{request.reason}”
                </p>
              )}
              <p className="mt-2 text-xs text-zinc-400">
                {dayLabel(request.employee.leaveBalance)} left after this
                request
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  id={`note-${request.id}`}
                  value={notes[request.id] ?? ""}
                  onChange={(event) => {
                    setNotes((prev) => ({
                      ...prev,
                      [request.id]: event.target.value,
                    }));

                    if (missingReasonId === request.id) {
                      setMissingReasonId("");
                    }
                  }}
                  maxLength={500}
                  placeholder="Note (required to reject)"
                  aria-label={`Note for ${request.employee.name}`}
                  aria-invalid={missingReasonId === request.id || undefined}
                  aria-describedby={
                    missingReasonId === request.id
                      ? `note-error-${request.id}`
                      : undefined
                  }
                  className="min-w-0 flex-1 basis-48 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 aria-invalid:border-red-400 aria-invalid:ring-4 aria-invalid:ring-red-500/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:aria-invalid:border-red-700"
                />
                <button
                  type="button"
                  onClick={() => decide(request.id, true)}
                  disabled={busyId !== ""}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <CheckIcon className="size-4" />
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => decide(request.id, false)}
                  disabled={busyId !== ""}
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3.5 py-2 text-sm font-medium text-zinc-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-red-900 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                >
                  <CloseIcon className="size-4" />
                  Reject
                </button>
              </div>

              {missingReasonId === request.id && (
                <p
                  id={`note-error-${request.id}`}
                  role="alert"
                  className="mt-2 text-sm text-red-600 dark:text-red-400"
                >
                  {REJECT_REASON_REQUIRED}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default TeamApprovals;
