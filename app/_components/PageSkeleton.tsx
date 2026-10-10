// Shown by loading.tsx while a page's server data loads, so navigating shows
// the page's outline straight away instead of waiting on a blank screen
function PageSkeleton({ variant = "page" }: { variant?: "page" | "chat" }) {
  const block = "rounded-2xl bg-zinc-200/70 dark:bg-zinc-800/70";

  return (
    <div
      className="flex min-h-dvh animate-pulse bg-zinc-50 dark:bg-zinc-950"
      aria-busy
      aria-label="Loading"
    >
      <div className="hidden w-64 shrink-0 flex-col gap-3 border-r border-zinc-200 bg-white p-4 md:flex dark:border-zinc-800 dark:bg-zinc-900">
        <div className="h-8 w-36 rounded-xl bg-zinc-200/70 dark:bg-zinc-800/70" />
        <div className="mt-3 h-9 rounded-lg bg-zinc-200/70 dark:bg-zinc-800/70" />
        <div className="h-9 rounded-lg bg-zinc-200/70 dark:bg-zinc-800/70" />
        <div className="h-9 rounded-lg bg-zinc-200/70 dark:bg-zinc-800/70" />
      </div>

      {variant === "chat" ? (
        <div className="flex flex-1 flex-col items-center justify-end gap-6 p-6">
          <div className={`h-24 w-full max-w-3xl ${block}`} />
        </div>
      ) : (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 sm:px-8">
          <div className="h-9 w-48 rounded-lg bg-zinc-200/70 dark:bg-zinc-800/70" />
          <div className="grid gap-4 sm:grid-cols-3">
            <div className={`h-32 ${block}`} />
            <div className={`h-32 ${block}`} />
            <div className={`h-32 ${block}`} />
          </div>
          <div className={`h-72 ${block}`} />
        </div>
      )}
    </div>
  );
}

export default PageSkeleton;
