import { redirect } from "next/navigation";

import PageShell from "@/app/_components/PageShell";
import { getLeaveOverview } from "@/lib/leave-overview";
import { getCurrentUser } from "@/lib/session";

import LeaveDashboard from "./_components/LeaveDashboard";

// Checked and loaded on the server, so a visitor without a session never sees
// the page and the page arrives with its data instead of fetching it after
async function LeavePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const data = await getLeaveOverview(user);

  return (
    <PageShell
      user={user}
      title="Leave"
      description="Your leave balance, requests and team approvals in one place."
    >
      <LeaveDashboard data={data} />
    </PageShell>
  );
}

export default LeavePage;
