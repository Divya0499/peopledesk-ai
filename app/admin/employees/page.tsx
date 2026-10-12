import { redirect } from "next/navigation";

import PageShell from "@/app/_components/PageShell";
import { listEmployees } from "@/lib/employees";
import { isAdminRole } from "@/lib/roles";
import { getCurrentUser } from "@/lib/session";

import EmployeeManager from "./_components/EmployeeManager";

// Admin-only. Others are sent to the chat rather than shown a page whose
// every API call would be refused.
async function EmployeesPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (!isAdminRole(user.role)) {
    redirect("/chat");
  }

  const employees = await listEmployees();

  return (
    <PageShell
      user={user}
      title="Employees"
      description="Add people, set their manager and adjust leave balances."
    >
      <EmployeeManager
        employees={employees}
        currentUserId={user.userId}
        currentUserRole={user.role}
      />
    </PageShell>
  );
}

export default EmployeesPage;
