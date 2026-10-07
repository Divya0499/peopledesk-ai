"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Development login form: sends an employee ID to /api/auth/login, which
// sets the session cookie. There are no passwords yet, so the ID is all it
// asks for.
export default function LoginPage() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [loggedInAs, setLoggedInAs] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoggedInAs("");
    setError("");
    setSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: userId.trim() }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.error ?? `Login failed: ${response.status}`);
        setSubmitting(false);
        return;
      }

      // Ask who the new session cookie belongs to, rather than trusting the
      // login response, so this proves the cookie actually works
      const meResponse = await fetch("/api/auth/me");
      const me = await meResponse.json().catch(() => null);

      if (!meResponse.ok) {
        setError(me?.error ?? `Session check failed: ${meResponse.status}`);
        setSubmitting(false);
        return;
      }

      setLoggedInAs(`${me.user.userId} (${me.user.role})`);
      // The button stays disabled while the chat page loads
      router.push("/chat");
    } catch (error) {
      setError(`Login failed: ${String(error)}`);
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid size-11 place-items-center rounded-xl bg-indigo-600 text-lg font-semibold text-white shadow-sm">
            AI
          </div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            Welcome back
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Log in to your company knowledge assistant
          </p>
        </div>

        <form
          onSubmit={login}
          className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          <label
            htmlFor="userId"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            User ID
          </label>
          <input
            id="userId"
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            placeholder="e.g. user-123"
            autoComplete="username"
            autoFocus
            className="mt-2 block w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-zinc-900 outline-none transition placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          />

          <button
            type="submit"
            disabled={submitting || !userId.trim()}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600"
          >
            {submitting && (
              <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            )}
            {submitting ? "Logging in…" : "Log in"}
          </button>

          {loggedInAs && (
            <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
              Logged in as {loggedInAs}. Redirecting to chat…
            </p>
          )}

          {error && (
            <p
              role="alert"
              className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-400"
            >
              {error}
            </p>
          )}
        </form>

        <p className="mt-6 text-center text-xs text-zinc-400">
          Development login · try user-123 or user-456
        </p>
      </div>
    </main>
  );
}
