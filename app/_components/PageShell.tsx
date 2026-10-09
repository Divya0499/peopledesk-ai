import Link from "next/link";
import type { ReactNode } from "react";

import LogoutButton from "@/app/chat/_components/LogoutButton";
import { SparkIcon } from "@/app/chat/_components/icons";
import type { CurrentUser } from "@/lib/session";

import Logo from "./Logo";
import NavLinks from "./NavLinks";
import UserCard from "./UserCard";

type PageShellProps = {
  user: CurrentUser;
  title: string;
  // One line under the title
  description?: string;
  // Shown right of the title, e.g. the page's main button
  actions?: ReactNode;
  children: ReactNode;
};

// The sidebar and page width shared by the pages outside the chat, so they
// look like the same app as the chat. Phones get a top bar instead; only one
// of the two is displayed at a time.
function PageShell({
  user,
  title,
  description,
  actions,
  children,
}: PageShellProps) {
  const isAdmin = user.role === "admin";

  return (
    <div className="flex min-h-dvh bg-zinc-50 dark:bg-zinc-950">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-zinc-200 bg-white md:flex dark:border-zinc-800 dark:bg-zinc-900">
        <div className="px-4 pt-4 pb-5">
          <Link href="/chat" aria-label="PeopleDesk AI home">
            <Logo />
          </Link>
        </div>

        <div className="px-3">
          <NavLinks isAdmin={isAdmin} variant="vertical" />
        </div>

        <div className="mt-auto p-3">
          <Link
            href="/chat"
            className="block rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 p-4 text-white shadow-md shadow-indigo-500/20 transition hover:shadow-lg hover:shadow-indigo-500/30"
          >
            <SparkIcon className="size-5" />
            <p className="mt-2 text-sm font-medium">Faster in chat</p>
            <p className="mt-0.5 text-xs text-indigo-100">
              Ask the assistant to check your balance or apply for leave.
            </p>
          </Link>
        </div>

        <UserCard name={user.name} role={user.role} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b border-zinc-200/70 bg-white/80 px-4 backdrop-blur-md md:hidden dark:border-zinc-800/70 dark:bg-zinc-900/80">
          <Link href="/chat" aria-label="PeopleDesk AI home">
            <Logo showName={false} />
          </Link>
          <NavLinks isAdmin={isAdmin} />
          <div className="ml-auto">
            <LogoutButton compact />
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                {title}
              </h1>
              {description && (
                <p className="mt-1.5 text-zinc-500 dark:text-zinc-400">
                  {description}
                </p>
              )}
            </div>
            {actions}
          </div>
          <div className="mt-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

export default PageShell;
