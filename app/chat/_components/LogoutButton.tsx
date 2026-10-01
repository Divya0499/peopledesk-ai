"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { LogoutIcon } from "./icons";

// Asks the server to clear the session cookie. The cookie is HttpOnly, so
// the browser can't remove it itself; only the logout route can.
function LogoutButton() {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);

    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      // replace, so Back doesn't return to the chat the user just left
      router.replace("/login");
    } catch (error) {
      console.error("Could not log out", error);
      setLoggingOut(false);
    }
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={loggingOut}
      className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
    >
      <LogoutIcon className="size-4" />
      <span className="hidden sm:inline">
        {loggingOut ? "Logging out…" : "Log out"}
      </span>
      <span className="sr-only sm:hidden">Log out</span>
    </button>
  );
}

export default LogoutButton;
