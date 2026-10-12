import Logo from "@/app/_components/Logo";
import {
  BookIcon,
  CalendarIcon,
  ShieldIcon,
  SparkIcon,
} from "@/app/chat/_components/icons";

import LoginForm from "./_components/LoginForm";

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

// A server component; only the form inside it runs in the browser
export default function LoginPage() {
  return (
    <main className="flex min-h-dvh bg-zinc-50 dark:bg-zinc-950">
      {/* Brand panel, only on wide screens */}
      <section className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-gradient-to-br from-indigo-950 via-zinc-900 to-violet-950 p-12 text-white lg:flex lg:border-r lg:border-white/5">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -right-32 size-96 rounded-full bg-indigo-500/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -left-24 size-[28rem] rounded-full bg-violet-500/10 blur-3xl"
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
          <p className="mt-4 text-zinc-300">
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
                    <span className="block text-sm text-zinc-400">
                      {feature.text}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <p className="relative text-xs text-zinc-500">
          Built with Next.js, LangGraph, Gemini and Pinecone
        </p>
      </section>

      <section className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-10">
        {/* soft light behind the form so the side isn't a flat block */}
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-1/2 size-[32rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/5 blur-3xl dark:bg-indigo-500/[0.07]"
        />
        <div className="relative w-full max-w-sm">
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

          <LoginForm />
        </div>
      </section>
    </main>
  );
}
