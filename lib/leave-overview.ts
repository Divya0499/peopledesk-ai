import "server-only";

import {
  isApprover,
  listMyLeaveRequests,
  listPendingForApprover,
} from "@/lib/leave";
import type { CurrentUser } from "@/lib/session";
import { getLeaveBalance } from "@/lib/tools";

// Everything the leave page shows: used by the page itself (on the server)
// and by GET /api/leave
export async function getLeaveOverview(user: CurrentUser) {
  const [balance, mine, approver] = await Promise.all([
    getLeaveBalance(user.userId),
    listMyLeaveRequests(user.userId),
    isApprover(user),
  ]);

  return {
    leaveBalance: ("leaveBalance" in balance ? balance.leaveBalance : 0) ?? 0,
    pendingDays: ("pendingDays" in balance ? balance.pendingDays : 0) ?? 0,
    mine,
    isApprover: approver,
    // null = not a manager, [] = nothing waiting
    teamPending: approver ? await listPendingForApprover(user) : null,
  };
}
