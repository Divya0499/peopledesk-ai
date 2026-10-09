"use client";

import { useCallback, useEffect, useState } from "react";

import Avatar from "@/app/_components/Avatar";
import {
  BuildingIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  ShieldIcon,
  UsersIcon,
} from "@/app/chat/_components/icons";

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

function Summary({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof UsersIcon;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
        <Icon className="size-5" />
      </span>
      <div>
        <p className="text-2xl font-semibold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">
          {value}
        </p>
        <p className="text-xs text-zinc-500">{label}</p>
      </div>
    </div>
  );
}

// The admin's employee list, with one form open at a time: adding a new
// employee or editing an existing one
function EmployeeManager({ currentUserId }: EmployeeManagerProps) {
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
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
      <p
        role="alert"
        className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400"
      >
        {error}
      </p>
    );
  }

  if (!employees) {
    return (
      <div className="flex animate-pulse flex-col gap-6" aria-label="Loading">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 rounded-2xl bg-zinc-200/70 dark:bg-zinc-800/70"
            />
          ))}
        </div>
        <div className="h-80 rounded-2xl bg-zinc-200/70 dark:bg-zinc-800/70" />
      </div>
    );
  }

  const closeForm = () => setEditing(null);
  const saved = () => {
    setEditing(null);
    reload();
  };

  const query = search.trim().toLowerCase();
  const shown = query
    ? employees.filter((employee) =>
        [employee.name, employee.email, employee.department].some((field) =>
          field.toLowerCase().includes(query),
        ),
      )
    : employees;

  const departments = new Set(employees.map((e) => e.department)).size;
  const managers = employees.filter((e) => e._count.reports > 0).length;
  const admins = employees.filter((e) => e.role === "admin").length;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Summary label="People" value={employees.length} icon={UsersIcon} />
        <Summary label="Departments" value={departments} icon={BuildingIcon} />
        <Summary label="Managers" value={managers} icon={UsersIcon} />
        <Summary label="HR admins" value={admins} icon={ShieldIcon} />
      </div>

      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center gap-3 border-b border-zinc-100 p-4 dark:border-zinc-800">
          <div className="relative min-w-0 flex-1 basis-56">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, email or department"
              aria-label="Search people"
              className="block w-full rounded-lg border border-zinc-200 bg-zinc-50 py-2 pr-3 pl-9 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            />
          </div>

          {/* hidden while the form is open, so its own submit button is the
              only "Add employee" on the page */}
          {!editing && (
            <button
              type="button"
              onClick={() => setEditing("new")}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-medium text-white shadow-md shadow-indigo-500/20 transition hover:from-indigo-500 hover:to-violet-500"
            >
              <PlusIcon className="size-4" />
              Add employee
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="bg-zinc-50/80 text-xs tracking-wider text-zinc-500 uppercase dark:bg-zinc-900">
              <tr>
                <th className="px-5 py-3 font-medium">Person</th>
                <th className="px-4 py-3 font-medium">Department</th>
                <th className="px-4 py-3 font-medium">Manager</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 text-right font-medium">Leave left</th>
                <th className="px-5 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {shown.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-12 text-center text-sm text-zinc-500"
                  >
                    No one matches “{search}”.
                  </td>
                </tr>
              )}

              {shown.map((employee) => (
                <tr
                  key={employee.id}
                  className="transition hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40"
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={employee.name} className="size-9 text-xs" />
                      <div className="min-w-0">
                        <p className="font-medium text-zinc-900 dark:text-zinc-50">
                          {employee.name}
                          {employee.id === currentUserId && (
                            <span className="ml-1.5 rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800">
                              you
                            </span>
                          )}
                        </p>
                        <p className="truncate text-zinc-500">{employee.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="inline-flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
                      <BuildingIcon className="size-3.5 text-zinc-400" />
                      {employee.department}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-zinc-700 dark:text-zinc-300">
                    {employee.manager?.name ?? (
                      <span className="text-zinc-400">None</span>
                    )}
                    {employee._count.reports > 0 && (
                      <p className="text-xs text-zinc-400">
                        Manages {employee._count.reports}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${
                        employee.role === "admin"
                          ? "bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-900"
                          : "bg-zinc-100 text-zinc-600 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700"
                      }`}
                    >
                      {employee.role}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                      {employee.leaveBalance}
                    </span>
                    <span className="ml-1 text-xs text-zinc-400">days</span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      type="button"
                      aria-label={`Edit ${employee.name}`}
                      onClick={() => setEditing(employee.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-zinc-600 transition hover:bg-indigo-50 hover:text-indigo-700 dark:text-zinc-400 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300"
                    >
                      <PencilIcon className="size-3.5" />
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {editing && (
        <EmployeeForm
          key={editing}
          employee={employees.find((employee) => employee.id === editing)}
          employees={employees}
          onSaved={saved}
          onCancel={closeForm}
        />
      )}
    </div>
  );
}

export default EmployeeManager;
