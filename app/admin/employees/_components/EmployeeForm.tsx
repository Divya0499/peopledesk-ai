"use client";

import { useEffect, useState } from "react";

import { CloseIcon } from "@/app/chat/_components/icons";

import type { Employee } from "./types";

type EmployeeFormProps = {
  employee?: Employee;
  employees: Employee[];
  onSaved: () => void;
  onCancel: () => void;
};

const inputClass =
  "mt-1.5 block w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50";
const labelClass = "text-sm font-medium text-zinc-700 dark:text-zinc-300";

function EmployeeForm({
  employee,
  employees,
  onSaved,
  onCancel,
}: EmployeeFormProps) {
  const editing = Boolean(employee);
  const [form, setForm] = useState({
    name: employee?.name ?? "",
    email: employee?.email ?? "",
    department: employee?.department ?? "",
    role: employee?.role ?? "employee",
    managerId: employee?.managerId ?? "",
    leaveBalance: String(employee?.leaveBalance ?? 24),
    password: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (field: keyof typeof form) => (value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const { password, leaveBalance, ...rest } = form;

    try {
      const response = await fetch(
        editing ? `/api/employees/${employee!.id}` : "/api/employees",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...rest,
            leaveBalance: Number(leaveBalance),
            // empty = keep current password
            ...(password && { password }),
          }),
        },
      );
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error ?? `Server error: ${response.status}`);
      }

      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
      setSaving(false);
    }
  }

  const managerOptions = employees.filter((other) => other.id !== employee?.id);

  // Escape closes the panel, like a dialog
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onCancel();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, saving]);

  return (
    <>
      <div
        aria-hidden
        onClick={saving ? undefined : onCancel}
        className="fixed inset-0 z-30 bg-zinc-950/30 backdrop-blur-sm"
      />

      {/* A panel from the right; not a modal <dialog>, so the page behind
          stays reachable for screen readers and tests */}
      <form
        onSubmit={submit}
        aria-labelledby="employee-form-title"
        className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-6 py-5 dark:border-zinc-800">
          <div>
            <h2
              id="employee-form-title"
              className="text-lg font-semibold text-zinc-900 dark:text-zinc-50"
            >
              {editing ? `Edit ${employee!.name}` : "Add employee"}
            </h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              {editing
                ? "Changes apply the next time they log in."
                : "They can log in with this email and password."}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            aria-label="Close panel"
            className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
          >
            <CloseIcon className="size-5" />
          </button>
        </div>

        <div className="grid flex-1 content-start gap-4 overflow-y-auto px-6 py-5 sm:grid-cols-2">
          <label className={`${labelClass} sm:col-span-2`}>
            Name
            <input
              required
              value={form.name}
              onChange={(e) => set("name")(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            Email
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => set("email")(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            Department
            <input
              required
              value={form.department}
              onChange={(e) => set("department")(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            Manager
            <select
              value={form.managerId}
              onChange={(e) => set("managerId")(e.target.value)}
              className={inputClass}
            >
              <option value="">No manager (HR approves leave)</option>
              {managerOptions.map((other) => (
                <option key={other.id} value={other.id}>
                  {other.name}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Role
            <select
              value={form.role}
              onChange={(e) => set("role")(e.target.value)}
              className={inputClass}
            >
              <option value="employee">Employee</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <label className={labelClass}>
            Leave balance (days)
            <input
              required
              type="number"
              min={0}
              max={365}
              step={1}
              value={form.leaveBalance}
              onChange={(e) => set("leaveBalance")(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            {editing ? "New password" : "Password"}
            {editing && (
              <span className="font-normal text-zinc-400">
                {" "}
                (leave blank to keep the current one)
              </span>
            )}
            <input
              type="password"
              required={!editing}
              minLength={8}
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => set("password")(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>

        {error && (
          <p
            role="alert"
            className="mx-6 mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-400"
          >
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-zinc-100 bg-zinc-50/80 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-medium text-white shadow-md shadow-indigo-500/20 transition hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving…" : editing ? "Save changes" : "Add employee"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="order-first rounded-lg border border-zinc-300 bg-white px-4 dark:bg-zinc-900 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
        </div>
      </form>
    </>
  );
}

export default EmployeeForm;
