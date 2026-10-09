import LogoutButton from "@/app/chat/_components/LogoutButton";

import Avatar from "./Avatar";

const ROLE_LABELS: Record<string, string> = {
  admin: "HR admin",
  employee: "Employee",
};

type UserCardProps = {
  name: string;
  role: string;
};

// Who is logged in, with the log out button; sits at the bottom of the sidebar
function UserCard({ name, role }: UserCardProps) {
  return (
    <div className="flex items-center gap-2.5 border-t border-zinc-200 px-3 py-3 dark:border-zinc-800">
      <Avatar name={name} className="size-9 text-xs" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
          {name}
        </p>
        <p className="truncate text-xs text-zinc-500">
          {ROLE_LABELS[role] ?? role}
        </p>
      </div>
      <LogoutButton compact />
    </div>
  );
}

export default UserCard;
