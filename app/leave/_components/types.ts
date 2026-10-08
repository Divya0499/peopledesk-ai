// Shapes returned by GET /api/leave (dates arrive as ISO strings)

export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";

export type LeaveRequest = {
  id: string;
  days: number;
  reason: string | null;
  status: LeaveStatus;
  createdAt: string;
  decidedAt: string | null;
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
