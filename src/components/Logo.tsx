"use client";

import Link from "next/link";

type Variant = "small" | "large" | "login" | "settings";

interface LogoProps {
  variant?: Variant;
  className?: string;
}

const iconSizes: Record<Variant, string> = {
  small: "h-9 w-9",
  large: "h-20 w-20 sm:h-24 sm:w-24",
  login: "h-32 w-32 sm:h-36 sm:w-36",
  settings: "h-12 w-12",
};

// Cristal de maná: facetas con los colores del tema (acento, acento suave, éxito)
const deep = "color-mix(in srgb, var(--accent) 55%, #000)";
const facets = [
  { points: "20,12 26,25 8,25", fill: "var(--accent-light)" },
  { points: "20,12 32,12 26,25", fill: "var(--accent)" },
  { points: "32,12 38,25 26,25", fill: "var(--success)" },
  { points: "32,12 44,12 38,25", fill: "var(--accent-light)" },
  { points: "44,12 56,25 38,25", fill: "var(--accent)" },
  { points: "8,25 26,25 32,55", fill: deep },
  { points: "26,25 38,25 32,55", fill: "var(--accent)" },
  { points: "38,25 56,25 32,55", fill: "var(--accent-light)" },
];

export function Logo({ variant = "large", className = "" }: LogoProps) {
  return (
    <Link
      href="/"
      className={`inline-block text-[var(--accent)] no-underline ${className}`}
    >
      <div
        className={`flex flex-col items-center justify-center gap-2 ${
          variant === "small" || variant === "settings" ? "flex-row gap-3" : ""
        }`}
      >
        <div
          className={`flex items-center justify-center transition-transform duration-300 [&:hover]:translate-y-[-2px] ${iconSizes[variant]}`}
        >
          <svg
            width="100%"
            height="100%"
            viewBox="0 8 64 52"
            xmlns="http://www.w3.org/2000/svg"
            style={{ filter: "drop-shadow(0 0 12px var(--accent-muted))" }}
          >
            <g style={{ stroke: "var(--negro)" }} strokeWidth="1.6" strokeLinejoin="round">
              {facets.map(({ points, fill }) => (
                <polygon key={points} points={points} style={{ fill }} />
              ))}
            </g>
          </svg>
        </div>
        <span
          className={`text-[var(--blanco)] font-black leading-none tracking-tight whitespace-nowrap m-0 ${
            variant === "small"
              ? "text-[1.6rem] tracking-[-0.02em]"
              : variant === "settings"
                ? "text-[1.75rem] tracking-[-0.02em]"
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
