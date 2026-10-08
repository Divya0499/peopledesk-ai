"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// The accounts prisma/seed.ts creates, so anyone trying the demo can log in
// as each kind of user. They only exist where the seed has been run.
const DEMO_PASSWORD = "PeopleDesk@123";
const DEMO_ACCOUNTS = [
  { email: "asha@peopledesk.dev", label: "HR admin" },
  { email: "vikram@peopledesk.dev", label: "Manager" },
  { email: "neha@peopledesk.dev", label: "Employee" },
];

const inputClass =
  "mt-2 block w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-zinc-900 outline-none transition placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50";

export default function LoginPage() {
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
    <main className="flex min-h-dvh items-center justify-center bg-zinc-50 px-4 py-10 dark:bg-zinc-950">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid size-11 place-items-center rounded-xl bg-indigo-600 text-lg font-semibold text-white shadow-sm">
            PD
          </div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            PeopleDesk AI
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Log in to your HR assistant
          </p>
        </div>

        <form
          onSubmit={login}
          className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
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
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600"
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

        <div className="mt-6 rounded-2xl border border-dashed border-zinc-300 p-4 text-sm dark:border-zinc-700">
          <p className="font-medium text-zinc-700 dark:text-zinc-300">
            Demo accounts
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">
            Password for all: {DEMO_PASSWORD}
          </p>
          <div className="mt-3 flex flex-col gap-1.5">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => {
                  setEmail(account.email);
                  setPassword(DEMO_PASSWORD);
                  setError("");
                }}
                className="flex items-center justify-between rounded-lg px-2 py-1.5 text-left text-zinc-600 transition hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                <span className="truncate">{account.email}</span>
                <span className="ml-2 shrink-0 text-xs text-zinc-400">
                  {account.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
