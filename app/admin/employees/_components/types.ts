// An employee as GET /api/employees returns it
export type Employee = {
  id: string;
  name: string;
  email: string;
  department: string;
  role: "employee" | "admin";
  leaveBalance: number;
  managerId: string | null;
  manager: { name: string } | null;
  _count: { reports: number };
};
