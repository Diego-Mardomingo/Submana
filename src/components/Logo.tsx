"use client";

import Link from "next/link";

type Variant = "small" | "large" | "login";

interface LogoProps {
  variant?: Variant;
  className?: string;
}

const iconSizes: Record<Variant, string> = {
  small: "h-9 w-9",
  large: "h-20 w-20 sm:h-24 sm:w-24",
  login: "h-32 w-32 sm:h-36 sm:w-36",
};

export function Logo({ variant = "large", className = "" }: LogoProps) {
  return (
    <Link
      href="/"
      className={`inline-block text-[var(--accent)] no-underline ${className}`}
    >
      <div
        className={`flex flex-col items-center justify-center gap-2 ${
          variant === "small" ? "flex-row gap-3" : ""
        }`}
      >
        <div
          className={`flex items-center justify-center transition-transform duration-300 [&:hover]:translate-y-[-2px] ${iconSizes[variant]}`}
        >
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ filter: "drop-shadow(0 0 12px var(--accent-muted))" }}
          >
            <path
              d="M12 2L2 7L12 12L22 7L12 2Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M2 17L12 22L22 17"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M2 12L12 17L22 12"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <span
          className={`text-[var(--blanco)] font-black leading-none tracking-tight whitespace-nowrap m-0 ${
            variant === "small"
              ? "text-[1.6rem] tracking-[-0.02em]"
              : variant === "login"
                ? "text-[2.8rem] sm:text-[4rem] tracking-[-0.05em]"
                : "text-[2.8rem] sm:text-[3.5rem] tracking-[-0.05em]"
          }`}
        >
          Submana
        </span>
      </div>
    </Link>
  );
}
