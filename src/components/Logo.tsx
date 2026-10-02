import Link from "next/link";
import { LogoMark } from "@/components/icons";

/** Big stacked logo linking home (login screen). */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`inline-block text-[var(--accent)] no-underline ${className}`}>
      <div className="flex flex-col items-center justify-center gap-2">
        <div className="flex items-center justify-center transition-transform duration-300 [&:hover]:translate-y-[-2px] h-32 w-32 sm:h-36 sm:w-36">
          <LogoMark style={{ filter: "drop-shadow(0 0 12px var(--accent-muted))" }} />
        </div>
        <span className="text-[var(--blanco)] font-black leading-none whitespace-nowrap m-0 text-[2.8rem] sm:text-[4rem] tracking-[-0.05em]">Submana</span>
      </div>
    </Link>
  );
}
