"use client";

import { useState } from "react";

import type { Employee } from "./types";

type EmployeeFormProps = {
  // The employee being edited; undefined to add a new one
  employee?: Employee;
  employees: Employee[];
  onSaved: () => void;
  onCancel: () => void;
};

const inputClass =
  "mt-1.5 block w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50";
const labelClass = "text-sm font-medium text-zinc-700 dark:text-zinc-300";

// Adds an employee, or edits one. The server validates everything again
// (unique email, manager loops, password length); the form just collects it.
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
            // Blank when editing keeps the current password
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

  // Anyone but the employee themselves can be their manager; the server
  // also rejects a choice that would make a reporting loop
  const managerOptions = employees.filter((other) => other.id !== employee?.id);

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-indigo-200 bg-white p-5 dark:border-indigo-900 dark:bg-zinc-900"
    >
      <h2 className="font-medium text-zinc-900 dark:text-zinc-50">
        {editing ? `Edit ${employee!.name}` : "Add employee"}
      </h2>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Name
          <input
            required
            value={form.name}
            onChange={(e) => set("name")(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          Email
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => set("email")(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          Department
          <input
            required
            value={form.department}
            onChange={(e) => set("department")(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
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
        <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="mt-5 flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Saving…" : editing ? "Save changes" : "Add employee"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export default EmployeeForm;
