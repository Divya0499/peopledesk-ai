import type { ReactNode } from "react";

import LogoutButton from "@/app/chat/_components/LogoutButton";
import type { CurrentUser } from "@/lib/session";

import NavLinks from "./NavLinks";

type PageShellProps = {
  user: CurrentUser;
  title: string;
  children: ReactNode;
};

// The header and page width shared by the pages outside the chat
function PageShell({ user, title, children }: PageShellProps) {
  return (
    <div className="min-h-dvh bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
          <span className="hidden text-sm font-semibold text-zinc-900 sm:inline dark:text-zinc-50">
            PeopleDesk AI
          </span>
          <NavLinks isAdmin={user.role === "admin"} />
          <span className="ml-auto hidden truncate text-sm text-zinc-500 md:inline">
            {user.name}
          </span>
          <LogoutButton />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {title}
        </h1>
        <div className="mt-6">{children}</div>
      </main>
    </div>
  );
}

export default PageShell;
