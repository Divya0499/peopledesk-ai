import { redirect } from "next/navigation";

import PageShell from "@/app/_components/PageShell";
import { listEmployees } from "@/lib/employees";
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

  const employees = await listEmployees();

  return (
    <PageShell
      user={user}
      title="Employees"
      description="Add people, set their manager and adjust leave balances."
    >
      <EmployeeManager employees={employees} currentUserId={user.userId} />
    </PageShell>
  );
}

export default EmployeesPage;
