// Initials on a colour picked from the name, so each person keeps theirs
const COLORS = [
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
];

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  const letters =
    parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2);

  return letters.toUpperCase();
}

function colorFor(name: string) {
  let hash = 0;

  for (const char of name) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0;
  }

  return COLORS[Math.abs(hash) % COLORS.length];
}

type AvatarProps = {
  name: string;
  className?: string;
};

function Avatar({ name, className = "size-8 text-xs" }: AvatarProps) {
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full font-semibold ${colorFor(name)} ${className}`}
    >
      {initials(name)}
    </span>
  );
}

export default Avatar;
