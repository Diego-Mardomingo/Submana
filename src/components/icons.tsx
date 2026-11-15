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

/* ── Section icons ──
   Submana's own set: 24px grid, round strokes in currentColor, and one "tinted" detail per icon
   (the same color at low opacity) that gives each its character and lights up with the accent. */

const Icon = ({ size = 20, strokeWidth = 1.75, className, style, children }: IconProps & { children: React.ReactNode }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden>
    {children}
  </svg>
);

/** The translucent fill behind an icon's key detail. */
const tint = { fill: "currentColor", fillOpacity: 0.28 } as const;

/** Home: a house with a mana-crystal window over an arched door. */
export const HomeIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M3.5 10.6 12 3.8l8.5 6.8V19a1.8 1.8 0 0 1-1.8 1.8H5.3A1.8 1.8 0 0 1 3.5 19z" />
    <path d="M12 8.2 13.7 9.9 12 11.6 10.3 9.9z" {...tint} />
    <path d="M9.6 20.8v-3.6a2.4 2.4 0 0 1 4.8 0v3.6" />
  </Icon>
);

/** Dashboard: three rounded bars, the tallest one highlighted. */
export const DashboardIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3.5" y="12" width="4.5" height="8.5" rx="1.6" />
    <rect x="9.75" y="3.5" width="4.5" height="17" rx="1.6" {...tint} />
    <rect x="16" y="8.5" width="4.5" height="12" rx="1.6" />
  </Icon>
);

/** Transactions: a ticket with money going both ways. */
export const TransactionsIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M2.8 7.2a2 2 0 0 1 2-2h14.4a2 2 0 0 1 2 2v2.3a2.5 2.5 0 0 0 0 5v2.3a2 2 0 0 1-2 2H4.8a2 2 0 0 1-2-2v-2.3a2.5 2.5 0 0 0 0-5z" {...tint} />
    <path d="M8 10h7.5l-2-2" />
    <path d="M16 14H8.5l2 2" />
  </Icon>
);

/** Subcount: a coin split in two halves, one for each side of the bill. */
export const SubcountIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M10.6 4.2a8 8 0 0 0 0 16z" />
    <path d="M13.4 3.2a8 8 0 0 1 0 16z" {...tint} />
  </Icon>
);

/** Accounts: a card whose chip is a crystal. */
export const AccountsIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="2.6" y="5" width="18.8" height="14" rx="3" />
    <path d="M7.4 9.6 9.3 11.5 7.4 13.4 5.5 11.5z" {...tint} />
    <path d="M12.4 15.4h5.2" />
  </Icon>
);

/** Categories: a shape sorter (circle, square, triangle, crystal). */
export const CategoriesIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="7" cy="7" r="3.3" />
    <rect x="13.7" y="3.7" width="6.6" height="6.6" rx="1.6" />
    <path d="M7 13.6 10.4 20H3.6z" />
    <path d="M17 13.4 20.6 17 17 20.6 13.4 17z" {...tint} />
  </Icon>
);

/** Subscriptions: a coin that comes back around every month. */
export const SubscriptionsIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M20.2 12A8.2 8.2 0 1 1 17.9 6.3" />
    <path d="M18.6 3.2 17.9 6.3 14.8 5.7" />
    <circle cx="12" cy="12" r="3.6" {...tint} />
  </Icon>
);

/** Budgets: a savings jar with its level wobbling. */
export const BudgetsIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="7" y="2.8" width="10" height="3.4" rx="1.2" />
    <path d="M8.3 6.2v1.2C6.1 8.5 5 10.2 5 12.3v5.5a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-5.5c0-2.1-1.1-3.8-3.3-4.9V6.2" />
    <path d="M5 14.2c2.3-1.2 4.7 1.2 7 0s4.7-1.2 7 0v3.6a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z" {...tint} stroke="none" />
    <path d="M5 14.2c2.3-1.2 4.7 1.2 7 0s4.7-1.2 7 0" />
  </Icon>
);

/** Friends: two people side by side, the one behind tinted. */
export const FriendsIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="16.4" cy="7.6" r="2.7" {...tint} />
    <path d="M16.6 13.4c2.6.3 4.6 2.5 4.6 5.4" />
    <circle cx="9" cy="8.2" r="3.3" />
    <path d="M2.8 20.2c0-3.4 2.8-6.1 6.2-6.1s6.2 2.7 6.2 6.1" />
  </Icon>
);

/** Notifications: a bell caught mid-ring. */
export const NotificationsIcon = (props: IconProps) => (
  <Icon {...props}>
    <g transform="rotate(-12 12 12)">
      <path d="M6.2 16.4v-5.1a5.8 5.8 0 0 1 11.6 0v5.1l1.6 1.8H4.6z" {...tint} />
      <path d="M10 20.8a2.1 2.1 0 0 0 4 0" />
    </g>
    <path d="M2.8 7.4a9.5 9.5 0 0 1 2.4-3.6" />
    <path d="M21.2 9.4a9.5 9.5 0 0 0-1.4-3.4" />
  </Icon>
);

/** Settings (the profile page): a portrait in a round frame. */
export const SettingsIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="10" r="3.1" {...tint} />
    <path d="M6.6 18.3c1.3-1.9 3.2-2.9 5.4-2.9s4.1 1 5.4 2.9" />
  </Icon>
);

/** Menu: three lines of different lengths ending in a dot. */
export const MenuIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 6.5h16" />
    <path d="M4 12h10.5" />
    <circle cx="18.5" cy="12" r="1.9" {...tint} />
    <path d="M4 17.5h13" />
  </Icon>
);
