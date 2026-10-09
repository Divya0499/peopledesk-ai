"use client";

import { useState } from "react";

import {
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  CloseIcon,
  InboxIcon,
} from "@/app/chat/_components/icons";

import { dayLabel, formatDate } from "./format";
import StatusBadge from "./StatusBadge";
import type { LeaveRequest, LeaveStatus } from "./types";

type MyRequestsProps = {
  requests: LeaveRequest[];
  onChanged: () => void;
};

const STATUS_ICONS: Record<LeaveStatus, { icon: typeof CheckIcon; className: string }> = {
  pending: {
    icon: ClockIcon,
    className: "bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400",
  },
  approved: {
    icon: CheckIcon,
    className: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400",
  },
  rejected: {
    icon: CloseIcon,
    className: "bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400",
  },
  cancelled: {
    icon: CalendarIcon,
    className: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
  },
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
    <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between gap-2 border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">
          My requests
        </h2>
        {requests.length > 0 && (
          <span className="text-xs text-zinc-500">
            {requests.length} total
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
        <div className="flex flex-col items-center px-5 py-12 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-zinc-100 text-zinc-400 dark:bg-zinc-800">
            <InboxIcon className="size-6" />
          </span>
          <p className="mt-3 font-medium text-zinc-900 dark:text-zinc-50">
            No requests yet
          </p>
          <p className="mt-1 max-w-xs text-sm text-zinc-500">
            Use the form, or just ask the assistant in chat.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {requests.map((request) => {
            const { icon: Icon, className } = STATUS_ICONS[request.status];

            return (
              <li
                key={request.id}
                className="flex items-start gap-4 px-5 py-4 transition hover:bg-zinc-50/70 dark:hover:bg-zinc-800/30"
              >
                <span
                  className={`grid size-10 shrink-0 place-items-center rounded-xl ${className}`}
                >
                  <Icon className="size-5" />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-zinc-900 dark:text-zinc-50">
                      {dayLabel(request.days)}
                    </span>
                    <StatusBadge status={request.status} />
                  </div>
                  <p className="mt-0.5 text-sm text-zinc-500">
                    Requested {formatDate(request.createdAt)}
                    {request.reason && ` · ${request.reason}`}
                  </p>
                  {request.decidedBy && (
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                      {request.status === "approved" ? "Approved" : "Rejected"}{" "}
                      by {request.decidedBy.name}
                      {request.decisionNote && `: “${request.decisionNote}”`}
                    </p>
                  )}
                </div>

                {request.status === "pending" && (
                  <button
                    type="button"
                    onClick={() => cancel(request.id)}
                    disabled={busyId !== ""}
                    className="shrink-0 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-red-900 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                  >
                    {busyId === request.id ? "Cancelling…" : "Cancel"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default MyRequests;
