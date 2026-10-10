"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import Avatar from "@/app/_components/Avatar";

// The accounts prisma/seed.ts creates, so anyone trying the demo can log in
// as each kind of user. They only exist where the seed has been run.
const DEMO_PASSWORD = "PeopleDesk@123";
const DEMO_ACCOUNTS = [
  { email: "asha@peopledesk.dev", name: "Asha Rao", label: "HR admin" },
  { email: "vikram@peopledesk.dev", name: "Vikram Shah", label: "Manager" },
  { email: "neha@peopledesk.dev", name: "Neha Gupta", label: "Employee" },
];

const inputClass =
  "mt-2 block w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-zinc-900 outline-none transition placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50";

// The interactive part of the login page: the form and the demo account
// buttons that fill it. The rest of the page is a server component.
function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.error ?? `Login failed: ${response.status}`);
        setSubmitting(false);
        return;
      }

      // The button stays disabled while the chat page loads
      router.push("/chat");
    } catch (error) {
      setError(`Login failed: ${String(error)}`);
      setSubmitting(false);
    }
  }

  return (
    <>
      <form
        onSubmit={login}
        className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-900/5 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/20"
      >
        <label
          htmlFor="email"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@company.com"
          autoComplete="username"
          autoFocus
          required
          className={inputClass}
        />

        <label
          htmlFor="password"
          className="mt-4 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
          className={inputClass}
        />

        <button
          type="submit"
          disabled={submitting || !email.trim() || !password}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-medium text-white shadow-md shadow-indigo-500/25 transition hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:bg-none disabled:bg-zinc-200 disabled:text-zinc-400 disabled:shadow-none dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600"
        >
          {submitting && (
            <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          )}
          {submitting ? "Logging in…" : "Log in"}
        </button>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-400"
          >
            {error}
          </p>
        )}
      </form>

      <div className="mt-8">
        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          <p className="text-xs font-medium text-zinc-500">
            Try a demo account
          </p>
          <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
        </div>

        <div className="mt-4 grid gap-2">
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.email}
              type="button"
              onClick={() => {
                setEmail(account.email);
                setPassword(DEMO_PASSWORD);
                setError("");
              }}
              className={`flex items-center gap-3 rounded-xl border bg-white px-3 py-2.5 text-left transition hover:border-indigo-300 hover:shadow-sm dark:bg-zinc-900 dark:hover:border-indigo-700 ${
                email === account.email
                  ? "border-indigo-400 ring-4 ring-indigo-500/10 dark:border-indigo-600"
                  : "border-zinc-200 dark:border-zinc-800"
              }`}
            >
              <Avatar name={account.name} className="size-9 text-xs" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  {account.name}
                </span>
                <span className="block truncate text-xs text-zinc-500">
                  {account.email}
                </span>
              </span>
              <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                {account.label}
              </span>
            </button>
          ))}
        </div>

        <p className="mt-3 text-center text-xs text-zinc-500">
          Password for all:{" "}
          <span className="font-mono text-zinc-700 dark:text-zinc-300">
            {DEMO_PASSWORD}
          </span>
        </p>
      </div>
    </>
  );
}

export default LoginForm;
