import Link from "next/link";
import { LogoMark } from "@/components/icons";

/** Logo linking home: big and stacked on login, inline in settings. */
export function Logo({ variant, className = "" }: { variant: "login" | "settings"; className?: string }) {
  const login = variant === "login";
  return (
    <Link href="/" className={`inline-block text-[var(--accent)] no-underline ${className}`}>
      <div className={`flex items-center justify-center ${login ? "flex-col gap-2" : "flex-row gap-3"}`}>
        <div
          className={`flex items-center justify-center transition-transform duration-300 [&:hover]:translate-y-[-2px] ${login ? "h-32 w-32 sm:h-36 sm:w-36" : "h-12 w-12"}`}
        >
          <LogoMark style={{ filter: "drop-shadow(0 0 12px var(--accent-muted))" }} />
        </div>
        <span
          className={`text-[var(--blanco)] font-black leading-none whitespace-nowrap m-0 ${
            login ? "text-[2.8rem] sm:text-[4rem] tracking-[-0.05em]" : "text-[1.75rem] tracking-[-0.02em]"
          }`}
        >
          Submana
        </span>
      </div>
    </Link>
  );
}
