type IconProps = { size?: number | string; strokeWidth?: number; className?: string; style?: React.CSSProperties };

/** Submana's stacked-layers mark. */
export const LogoMark = ({ size = "100%", strokeWidth = 2, className, style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <path d="M12 2L2 7L12 12L22 7L12 2Z" />
    <path d="M2 17L12 22L22 17" />
    <path d="M2 12L12 17L22 12" />
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
