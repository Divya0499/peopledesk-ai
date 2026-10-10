// What the leave page shows. Dates are Date objects when the server page
// passes them, ISO strings when they come from GET /api/leave

export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";

export type LeaveRequest = {
  id: string;
  days: number;
  reason: string | null;
  status: LeaveStatus;
  createdAt: Date | string;
  decidedAt: Date | string | null;
  decisionNote: string | null;
  decidedBy: { name: string } | null;
};

export type TeamRequest = LeaveRequest & {
  employee: {
    id: string;
    name: string;
    department: string;
    leaveBalance: number;
  };
};

export type LeaveData = {
  leaveBalance: number;
  pendingDays: number;
  mine: LeaveRequest[];
  isApprover: boolean;
  // null when the caller approves no one's leave
  teamPending: TeamRequest[] | null;
};
