"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { CalendarIcon, SparkIcon, UsersIcon } from "@/app/chat/_components/icons";

type NavLinksProps = {
  // Employees is admin-only; the page and its API check this again
  isAdmin: boolean;
  // "vertical" in the chat sidebar, "horizontal" in the page header
  variant?: "horizontal" | "vertical";
};

// The links between the app's pages, with the current one highlighted
function NavLinks({ isAdmin, variant = "horizontal" }: NavLinksProps) {
  const pathname = usePathname();
  const vertical = variant === "vertical";

  const links = [
    { href: "/chat", label: "Assistant", icon: SparkIcon },
    { href: "/leave", label: "Leave", icon: CalendarIcon },
    ...(isAdmin
      ? [{ href: "/admin/employees", label: "Employees", icon: UsersIcon }]
      : []),
  ];

  return (
    <nav
      aria-label="Main"
      className={vertical ? "flex flex-col gap-0.5" : "flex items-center gap-1"}
    >
      {links.map((link) => {
        const active =
          pathname === link.href || (link.href === "/chat" && pathname === "/");
        const Icon = link.icon;

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-2 rounded-lg text-sm transition ${
              vertical ? "px-2.5 py-2" : "px-2.5 py-1.5"
            } ${
              active
                ? "bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            }`}
          >
            <Icon className="size-4 shrink-0" />
            {/* Icons only in the header on phones; the name stays for screen readers */}
            <span className={vertical ? "" : "sr-only sm:not-sr-only"}>
              {link.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

export default NavLinks;
