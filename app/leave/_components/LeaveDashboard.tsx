"use client";

import { useCallback, useEffect, useState } from "react";

import {
  CalendarIcon,
  CheckIcon,
  ClockIcon,
} from "@/app/chat/_components/icons";

import MyRequests from "./MyRequests";
import RequestLeaveForm from "./RequestLeaveForm";
import TeamApprovals from "./TeamApprovals";
import type { LeaveData } from "./types";

async function fetchLeave(): Promise<LeaveData> {
  const response = await fetch("/api/leave", { cache: "no-store" });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error ?? `Server error: ${response.status}`);
  }

  return data;
}

type StatCardProps = {
  label: string;
  value: number;
  hint: string;
  icon: typeof CalendarIcon;
  tone: keyof typeof TONES;
};

const TONES = {
  indigo: {
    icon: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400",
    bar: "from-indigo-500 to-violet-500",
  },
  amber: {
    icon: "bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400",
    bar: "from-amber-400 to-orange-500",
  },
  emerald: {
    icon: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400",
    bar: "from-emerald-400 to-teal-500",
  },
};

function StatCard({ label, value, hint, icon: Icon, tone }: StatCardProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <span
        aria-hidden
        className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${TONES[tone].bar}`}
      />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-zinc-500">{label}</p>
          {/* the number stays alone in its <p>; the e2e tests read it */}
          <div className="mt-1 flex items-baseline gap-1.5 sm:mt-2">
            <p className="text-3xl font-semibold sm:text-4xl tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">
              {value}
            </p>
            <span className="text-sm text-zinc-400">
              {value === 1 ? "day" : "days"}
            </span>
          </div>
        </div>
        <span
          className={`grid size-11 shrink-0 place-items-center rounded-xl ${TONES[tone].icon}`}
        >
          <Icon className="size-5" />
        </span>
      </div>
      <p className="mt-3 hidden text-xs text-zinc-500 sm:block">{hint}</p>
    </div>
  );
}

// just reload everything after each action, simpler than updating state
function LeaveDashboard() {
  const [data, setData] = useState<LeaveData | null>(null);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    try {
      setData(await fetchLeave());
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load leave");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  if (error && !data) {
    return (
      <p
        role="alert"
        className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400"
      >
        {error}
      </p>
    );
  }

  if (!data) {
    return (
      <div className="flex animate-pulse flex-col gap-6" aria-label="Loading">
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-36 rounded-2xl bg-zinc-200/70 dark:bg-zinc-800/70"
            />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
          <div className="h-72 rounded-2xl bg-zinc-200/70 dark:bg-zinc-800/70" />
          <div className="h-72 rounded-2xl bg-zinc-200/70 dark:bg-zinc-800/70" />
        </div>
      </div>
    );
  }

  const approvedDays = data.mine
    .filter((request) => request.status === "approved")
    .reduce((total, request) => total + request.days, 0);
  const pendingCount = data.mine.filter(
    (request) => request.status === "pending",
  ).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Days available to request"
          value={data.leaveBalance}
          hint="Pending requests are already taken out."
          icon={CalendarIcon}
          tone="indigo"
        />
        <StatCard
          label="Days waiting for approval"
          value={data.pendingDays}
          hint={
            pendingCount === 0
              ? "No requests waiting on your manager."
              : `${pendingCount} ${pendingCount === 1 ? "request" : "requests"} waiting on your manager.`
          }
          icon={ClockIcon}
          tone="amber"
        />
        <StatCard
          label="Days approved"
          value={approvedDays}
          hint="Leave your manager has signed off."
          icon={CheckIcon}
          tone="emerald"
        />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
        {/* first in the page on phones, right-hand column on wide screens */}
        <div className="lg:sticky lg:top-6 lg:col-start-2 lg:row-start-1">
          <RequestLeaveForm
            available={data.leaveBalance}
            onRequested={reload}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-6 lg:col-start-1 lg:row-start-1">
          {data.teamPending && (
            <TeamApprovals requests={data.teamPending} onChanged={reload} />
          )}
          <MyRequests requests={data.mine} onChanged={reload} />
        </div>
      </div>
    </div>
  );
}

export default LeaveDashboard;
