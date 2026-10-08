"use client";

import { useCallback, useEffect, useState } from "react";

import EmployeeForm from "./EmployeeForm";
import type { Employee } from "./types";

type EmployeeManagerProps = {
  currentUserId: string;
};

async function fetchEmployees(): Promise<Employee[]> {
  const response = await fetch("/api/employees", { cache: "no-store" });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error ?? `Server error: ${response.status}`);
  }

  return data.employees;
}

// The admin's employee list, with one form open at a time: adding a new
// employee or editing an existing one
function EmployeeManager({ currentUserId }: EmployeeManagerProps) {
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [error, setError] = useState("");
  // "new", an employee id being edited, or null when no form is open
  const [editing, setEditing] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setEmployees(await fetchEmployees());
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load employees");
    }
  }, []);

  useEffect(() => {
    // The first load sets state once its fetch resolves
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  if (error && !employees) {
    return (
      <p role="alert" className="text-sm text-red-600 dark:text-red-400">
        {error}
      </p>
    );
  }

  if (!employees) {
    return <p className="text-sm text-zinc-500">Loading…</p>;
  }

  const closeForm = () => setEditing(null);
  const saved = () => {
    setEditing(null);
    reload();
  };

  return (
    <div className="flex flex-col gap-6">
      {editing ? (
        <EmployeeForm
          key={editing}
          employee={employees.find((employee) => employee.id === editing)}
          employees={employees}
          onSaved={saved}
          onCancel={closeForm}
        />
      ) : (
        <div>
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
          >
            Add employee
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="border-b border-zinc-100 text-zinc-500 dark:border-zinc-800">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Department</th>
              <th className="px-4 py-3 font-medium">Manager</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 text-right font-medium">Leave</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {employees.map((employee) => (
              <tr key={employee.id}>
                <td className="px-4 py-3">
                  <p className="font-medium text-zinc-900 dark:text-zinc-50">
                    {employee.name}
                    {employee.id === currentUserId && (
                      <span className="ml-1.5 text-xs font-normal text-zinc-400">
                        (you)
                      </span>
                    )}
                  </p>
                  <p className="text-zinc-500">{employee.email}</p>
                </td>
                <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                  {employee.department}
                </td>
                <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                  {employee.manager?.name ?? "—"}
                  {employee._count.reports > 0 && (
                    <p className="text-xs text-zinc-400">
                      Manages {employee._count.reports}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 capitalize text-zinc-700 dark:text-zinc-300">
                  {employee.role}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                  {employee.leaveBalance}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    aria-label={`Edit ${employee.name}`}
                    onClick={() => {
                      setEditing(employee.id);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="rounded-lg px-2.5 py-1 text-indigo-600 transition hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default EmployeeManager;
