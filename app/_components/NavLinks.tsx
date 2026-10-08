"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavLinksProps = {
  // Employees is admin-only; the page and its API check this again
  isAdmin: boolean;
};

// The links between the app's pages, with the current one highlighted
function NavLinks({ isAdmin }: NavLinksProps) {
  const pathname = usePathname();

  const links = [
    { href: "/chat", label: "Assistant" },
    { href: "/leave", label: "Leave" },
    ...(isAdmin ? [{ href: "/admin/employees", label: "Employees" }] : []),
  ];

  return (
    <nav aria-label="Main" className="flex items-center gap-1">
      {links.map((link) => {
        const active =
          pathname === link.href || (link.href === "/chat" && pathname === "/");

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg px-2.5 py-1.5 text-sm transition ${
              active
                ? "bg-zinc-100 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

export default NavLinks;
