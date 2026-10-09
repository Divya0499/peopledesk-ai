"use client";

import { useCallback, useEffect, useState } from "react";

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

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
        {value}
      </p>
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
      <p role="alert" className="text-sm text-red-600 dark:text-red-400">
        {error}
      </p>
    );
  }

  if (!data) {
    return <p className="text-sm text-zinc-500">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Days available to request" value={data.leaveBalance} />
        <StatCard label="Days waiting for approval" value={data.pendingDays} />
      </div>

      {data.teamPending && (
        <TeamApprovals requests={data.teamPending} onChanged={reload} />
      )}

      <RequestLeaveForm available={data.leaveBalance} onRequested={reload} />
      <MyRequests requests={data.mine} onChanged={reload} />
    </div>
  );
}

export default LeaveDashboard;
