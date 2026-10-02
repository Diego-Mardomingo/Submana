type IconProps = { size?: number | string; strokeWidth?: number; className?: string; style?: React.CSSProperties };

/** Submana's "Cristal de maná" mark; facets follow the theme's accent and success colors. */
const LOGO_FACETS = [
  { points: "20,12 26,25 8,25", fill: "var(--accent-light)" },
  { points: "20,12 32,12 26,25", fill: "var(--accent)" },
  { points: "32,12 38,25 26,25", fill: "var(--success)" },
  { points: "32,12 44,12 38,25", fill: "var(--accent-light)" },
  { points: "44,12 56,25 38,25", fill: "var(--accent)" },
  { points: "8,25 26,25 32,55", fill: "color-mix(in srgb, var(--accent) 55%, #000)" },
  { points: "26,25 38,25 32,55", fill: "var(--accent)" },
  { points: "38,25 56,25 32,55", fill: "var(--accent-light)" },
];

export const LogoMark = ({ size = "100%", className, style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 8 64 52" className={className} style={style}>
    <g style={{ stroke: "var(--negro)" }} strokeWidth={1.6} strokeLinejoin="round">
      {LOGO_FACETS.map(({ points, fill }) => (
        <polygon key={points} points={points} style={{ fill }} />
      ))}
    </g>
  </svg>
);

/** Receipt with a euro sign. */
export const TransactionsIcon = ({ size = 20, strokeWidth = 1.5, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} className={className}>
    <path d="M5 21v-16a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v16l-3 -2l-2 2l-2 -2l-2 2l-2 -2l-3 2" />
    <path d="M15 7.8c-.523 -.502 -1.172 -.8 -1.875 -.8c-1.727 0 -3.125 1.791 -3.125 4s1.398 4 3.125 4c.703 0 1.352 -.298 1.874 -.8" />
    <path d="M9 11h4" />
  </svg>
);
