"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import Avatar from "@/app/_components/Avatar";
import Logo from "@/app/_components/Logo";
import {
  BookIcon,
  CalendarIcon,
  ShieldIcon,
  SparkIcon,
} from "@/app/chat/_components/icons";

// The accounts prisma/seed.ts creates, so anyone trying the demo can log in
// as each kind of user. They only exist where the seed has been run.
const DEMO_PASSWORD = "PeopleDesk@123";
const DEMO_ACCOUNTS = [
  { email: "asha@peopledesk.dev", name: "Asha Rao", label: "HR admin" },
  { email: "vikram@peopledesk.dev", name: "Vikram Shah", label: "Manager" },
  { email: "neha@peopledesk.dev", name: "Neha Gupta", label: "Employee" },
];

const FEATURES = [
  {
    icon: BookIcon,
    title: "Answers from your policies",
    text: "Every answer links to the policy document it came from.",
  },
  {
    icon: CalendarIcon,
    title: "Leave in a sentence",
    text: "Ask for leave in chat; your manager approves it in one click.",
  },
  {
    icon: ShieldIcon,
    title: "Nothing happens without you",
    text: "The assistant asks you to confirm before it changes anything.",
  },
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
    <main className="flex min-h-dvh bg-zinc-50 dark:bg-zinc-950">
      {/* Brand panel, only on wide screens */}
      <section className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 p-12 text-white lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -right-32 size-96 rounded-full bg-white/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -left-24 size-[28rem] rounded-full bg-violet-400/20 blur-3xl"
        />

        <div className="relative flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-white/15 ring-1 ring-white/25">
            <SparkIcon className="size-4.5" />
          </span>
          <span className="font-semibold tracking-tight">PeopleDesk AI</span>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-4xl leading-tight font-semibold tracking-tight">
            Your HR desk, in one chat.
          </h2>
          <p className="mt-4 text-indigo-100">
            Ask about company policies, check your leave balance and apply for
            leave without filling in a form.
          </p>

          <ul className="mt-10 flex flex-col gap-5">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;

              return (
                <li key={feature.title} className="flex gap-3.5">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10 ring-1 ring-white/20">
                    <Icon className="size-5" />
                  </span>
                  <span>
                    <span className="block font-medium">{feature.title}</span>
                    <span className="block text-sm text-indigo-200">
                      {feature.text}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <p className="relative text-xs text-indigo-200">
          Built with Next.js, LangGraph, Gemini and Pinecone
        </p>
      </section>

      <section className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <div className="mb-6 lg:hidden">
              <Logo size="lg" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Welcome back
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Log in to your HR assistant
            </p>
          </div>

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
        </div>
      </section>
    </main>
  );
}
