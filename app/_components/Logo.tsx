import { SparkIcon } from "@/app/chat/_components/icons";

type LogoProps = {
  // "sm" for headers and the sidebar, "lg" for the login page
  size?: "sm" | "lg";
  // false shows only the mark, e.g. on narrow screens
  showName?: boolean;
};

// The app's mark and name, the same everywhere it appears
function Logo({ size = "sm", showName = true }: LogoProps) {
  const large = size === "lg";

  return (
    <span className="flex items-center gap-2.5">
      <span
        className={`grid shrink-0 place-items-center bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/25 ${
          large ? "size-11 rounded-2xl" : "size-8 rounded-xl"
        }`}
      >
        <SparkIcon className={large ? "size-5" : "size-4"} />
      </span>
      {showName && (
        <span
          className={`font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 ${
            large ? "text-xl" : ""
          }`}
        >
          PeopleDesk <span className="text-indigo-600 dark:text-indigo-400">AI</span>
        </span>
      )}
    </span>
  );
}

export default Logo;
