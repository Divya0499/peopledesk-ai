// "8 Oct 2026", in the viewer's time zone
export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function dayLabel(days: number) {
  return `${days} ${days === 1 ? "day" : "days"}`;
}
