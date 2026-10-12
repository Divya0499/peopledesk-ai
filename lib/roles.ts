// no prisma import, so client components can use it too
export const ROLES = ["employee", "admin", "super_admin"] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  employee: "Employee",
  admin: "HR admin",
  super_admin: "Super admin",
};

// admin rights: employees page, document upload, leave of people without a manager
export function isAdminRole(role: string) {
  return role === "admin" || role === "super_admin";
}

// only a super admin can give or take away admin rights, or edit an admin's account
export function canAssignRole(actorRole: string, role: string) {
  return actorRole === "super_admin" || !isAdminRole(role);
}
