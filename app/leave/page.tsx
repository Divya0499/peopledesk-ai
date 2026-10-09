import { redirect } from "next/navigation";

import PageShell from "@/app/_components/PageShell";
import { getCurrentUser } from "@/lib/session";

import LeaveDashboard from "./_components/LeaveDashboard";

// Checked on the server, so a visitor without a session never sees the page
async function LeavePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <PageShell
      user={user}
      title="Leave"
      description="Your leave balance, requests and team approvals in one place."
    >
      <LeaveDashboard />
    </PageShell>
  );
}

export default LeavePage;
