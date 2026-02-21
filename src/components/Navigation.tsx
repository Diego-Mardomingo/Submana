"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useCallback } from "react";
import {
  House,
  LayoutDashboard,
  Calendar,
  CreditCard,
  Receipt,
  Tags,
  Bell,
  Settings,
  Wallet,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { useLang } from "@/hooks/useLang";
import { useTranslations } from "@/lib/i18n/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import styles from "./Navigation.module.css";

const iconProps = { size: 20, strokeWidth: 1.5 };

export default function Navigation() {
  const pathname = usePathname();
  const lang = useLang();
  const t = useTranslations(lang);

  const currentPath = pathname === "/" ? "/" : pathname.replace(/\/$/, "");

  const [expanded, setExpanded] = useState(false);

  const closeExpand = useCallback(() => setExpanded(false), []);

  const NavLink = ({
    href,
    children,
    extra,
    label,
  }: {
    href: string;
    children: React.ReactNode;
    extra?: boolean;
    label: string;
  }) => {
    const isActive = currentPath === href;
    const linkEl = (
      <Link
        href={href}
        className={`${styles.navItem} ${isActive ? styles.active : ""} ${extra ? styles.extraItem : ""}`}
        onClick={closeExpand}
      >
        {children}
      </Link>
    );
    return (
      <Tooltip>
        <TooltipTrigger asChild>{linkEl}</TooltipTrigger>
        <TooltipContent side="top" sideOffset={8}>
          {label}
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
            <NavLink href="/" label={t("nav.home")}>
              <House {...iconProps} />
              <span>{t("nav.home")}</span>
            </NavLink>
            <NavLink href="/dashboard" label={t("nav.dashboard")}>
              <LayoutDashboard {...iconProps} />
              <span>{t("nav.dashboard")}</span>
            </NavLink>
            <NavLink href="/transactions" label={t("nav.transactions")}>
              <Receipt {...iconProps} />
              <span>{t("nav.transactions")}</span>
            </NavLink>
            <NavLink href="/accounts" extra label={t("nav.accounts")}>
              <CreditCard {...iconProps} />
              <span>{t("nav.accounts")}</span>
            </NavLink>
            <NavLink href="/categories" extra label={t("nav.categories")}>
              <Tags {...iconProps} />
              <span>{t("nav.categories")}</span>
            </NavLink>
            <NavLink href="/subscriptions" extra label={t("nav.subscriptions")}>
              <Calendar {...iconProps} />
              <span>{t("nav.subscriptions")}</span>
            </NavLink>
            <NavLink href="/budgets" extra label={t("nav.budgets")}>
              <Wallet {...iconProps} />
              <span>{t("nav.budgets")}</span>
            </NavLink>
            <NavLink href="/notifications" extra label={t("nav.notifications")}>
              <Bell {...iconProps} />
              <span>{t("nav.notifications")}</span>
            </NavLink>
            <NavLink href="/settings" extra label={t("nav.settings")}>
              <Settings {...iconProps} />
              <span>{t("nav.settings")}</span>
            </NavLink>
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
