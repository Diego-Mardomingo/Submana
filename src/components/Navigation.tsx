"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useCallback, useEffect } from "react";
import {
  House,
  LayoutDashboard,
  Calendar,
  CreditCard,
  Tags,
  Bell,
  Settings,
  Wallet,
  ChevronUp,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";

function TransactionsIcon({ size = 20, strokeWidth = 1.5 }: { size?: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}>
      <path d="M5 21v-16a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v16l-3 -2l-2 2l-2 -2l-2 2l-2 -2l-3 2" />
      <path d="M15 7.8c-.523 -.502 -1.172 -.8 -1.875 -.8c-1.727 0 -3.125 1.791 -3.125 4s1.398 4 3.125 4c.703 0 1.352 -.298 1.874 -.8" />
      <path d="M9 11h4" />
    </svg>
  );
}
import { useLang } from "@/hooks/useLang";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useTranslations } from "@/lib/i18n/utils";
import type { UIKey } from "@/lib/i18n/ui";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import styles from "./Navigation.module.css";

const iconProps = { size: 20, strokeWidth: 1.5 };

type NavItem = {
  href: string;
  shortcut: string;
  labelKey: UIKey;
  icon: LucideIcon | React.ComponentType<{ size?: number; strokeWidth?: number }>;
  extra?: boolean;
};

const navItems: NavItem[] = [
  { href: "/", shortcut: "f", labelKey: "nav.home", icon: House },
  { href: "/dashboard", shortcut: "d", labelKey: "nav.dashboard", icon: LayoutDashboard },
  { href: "/transactions", shortcut: "q", labelKey: "nav.transactions", icon: TransactionsIcon },
  { href: "/accounts", shortcut: "a", labelKey: "nav.accounts", icon: CreditCard, extra: true },
  { href: "/categories", shortcut: "c", labelKey: "nav.categories", icon: Tags, extra: true },
  { href: "/subscriptions", shortcut: "s", labelKey: "nav.subscriptions", icon: Calendar, extra: true },
  { href: "/budgets", shortcut: "e", labelKey: "nav.budgets", icon: Wallet, extra: true },
  { href: "/notifications", shortcut: "z", labelKey: "nav.notifications", icon: Bell, extra: true },
  { href: "/settings", shortcut: "x", labelKey: "nav.settings", icon: Settings, extra: true },
];

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const lang = useLang();
  const t = useTranslations(lang);
  const isMobile = useMediaQuery("(max-width: 767px)");

  const currentPath = pathname === "/" ? "/" : pathname.replace(/\/$/, "");

  const [expanded, setExpanded] = useState(false);

  const closeExpand = useCallback(() => setExpanded(false), []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;

      const item = navItems.find((n) =>
        n.shortcut.toLowerCase() === e.key.toLowerCase()
      );
      if (item) {
        e.preventDefault();
        router.push(item.href);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  useEffect(() => {
    const mainRoutes = ["/", "/dashboard", "/transactions"];
    mainRoutes.forEach((route) => router.prefetch(route));
  }, [router]);

  const NavLink = ({
    href,
    children,
    extra,
    label,
    shortcut,
  }: {
    href: string;
    children: React.ReactNode;
    extra?: boolean;
    label: string;
    shortcut: string;
  }) => {
    const isActive = currentPath === href;
    const displayShortcut = shortcut.toLowerCase() === "tab" ? "⇥ TAB" : shortcut.toUpperCase();
    const tooltipShortcut = shortcut.toLowerCase() === "tab" ? "Tab" : shortcut.toUpperCase();
    const linkEl = (
      <Link
        href={href}
        prefetch={true}
        className={`${styles.navItem} ${isActive ? styles.active : ""} ${extra ? styles.extraItem : ""}`}
        onClick={closeExpand}
      >
        {children}
        <kbd className={styles.shortcutBadge}>{displayShortcut}</kbd>
      </Link>
    );
    if (isMobile) return linkEl;
    return (
      <Tooltip>
        <TooltipTrigger asChild>{linkEl}</TooltipTrigger>
        <TooltipContent side="top" sideOffset={8}>
          {label} ({tooltipShortcut})
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <>
      <nav
        className={`${styles.navigation} ${expanded ? styles.expanded : ""}`}
        id="main-nav"
      >
        <div className={styles.navContent}>
          <div className={styles.logoContainer}>
            <Link href="/" className={styles.logoLink}>
              <div className={styles.logoInner}>
                <div className={styles.logoIcon}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L2 7L12 12L22 7L12 2Z" />
                    <path d="M2 17L12 22L22 17" />
                    <path d="M2 12L12 17L22 12" />
                  </svg>
                </div>
                <span className={styles.submanaText}>Submana</span>
              </div>
            </Link>
          </div>
          <div className={styles.navItemsWrapper}>
            {navItems.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                label={t(item.labelKey)}
                extra={item.extra}
                shortcut={item.shortcut}
              >
                <item.icon {...iconProps} />
                <span>{t(item.labelKey)}</span>
              </NavLink>
            ))}
            {isMobile ? (
              <Button
                type="button"
                variant="ghost"
                className={cn(styles.navItem, styles.moreBtn)}
                onClick={() => setExpanded((e) => !e)}
                aria-label={t("nav.menu")}
              >
                <div className={styles.iconContainer}>
                  {expanded ? (
                    <ChevronDown {...iconProps} />
                  ) : (
                    <ChevronUp {...iconProps} />
                  )}
                </div>
                <span>{expanded ? t("nav.close") : t("nav.menu")}</span>
              </Button>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    className={cn(styles.navItem, styles.moreBtn)}
                    onClick={() => setExpanded((e) => !e)}
                    aria-label={t("nav.menu")}
                  >
                    <div className={styles.iconContainer}>
                      {expanded ? (
                        <ChevronDown {...iconProps} />
                      ) : (
                        <ChevronUp {...iconProps} />
                      )}
                    </div>
                    <span>{expanded ? t("nav.close") : t("nav.menu")}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8}>
                  {expanded ? t("nav.close") : t("nav.menu")}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </nav>
      <div
        className={`${styles.navBackdrop} ${expanded ? styles.visible : ""}`}
        onClick={closeExpand}
        onKeyDown={(e) => e.key === "Escape" && closeExpand()}
        role="button"
        tabIndex={0}
        aria-label="Close menu"
      />
    </>
  );
}
