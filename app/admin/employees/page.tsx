import { redirect } from "next/navigation";

import PageShell from "@/app/_components/PageShell";
import { getCurrentUser } from "@/lib/session";

import EmployeeManager from "./_components/EmployeeManager";

// Admin-only. Others are sent to the chat rather than shown a page whose
// every API call would be refused.
async function EmployeesPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== "admin") {
    redirect("/chat");
  }

  return (
    <PageShell
      user={user}
      title="Employees"
      description="Add people, set their manager and adjust leave balances."
    >
      <EmployeeManager currentUserId={user.userId} />
    </PageShell>
  );
}

export default EmployeesPage;
