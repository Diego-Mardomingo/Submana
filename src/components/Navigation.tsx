"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useCallback } from "react";
import {
  House,
  Calendar,
  CreditCard,
  Receipt,
  Tags,
  Bell,
  Settings,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { useLang } from "@/hooks/useLang";
import { useTranslations } from "@/lib/i18n/utils";
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
  }: {
    href: string;
    children: React.ReactNode;
    extra?: boolean;
  }) => {
    const isActive = currentPath === href;
    return (
      <Link
        href={href}
        className={`${styles.navItem} ${isActive ? styles.active : ""} ${extra ? styles.extraItem : ""}`}
        onClick={closeExpand}
      >
        {children}
      </Link>
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
            <NavLink href="/">
              <House {...iconProps} />
              <span>{t("nav.home")}</span>
            </NavLink>
            <NavLink href="/subscriptions">
              <Calendar {...iconProps} />
              <span>{t("nav.subscriptions")}</span>
            </NavLink>
            <NavLink href="/accounts" extra>
              <CreditCard {...iconProps} />
              <span>{t("nav.accounts")}</span>
            </NavLink>
            <NavLink href="/transactions">
              <Receipt {...iconProps} />
              <span>{t("nav.transactions")}</span>
            </NavLink>
            <NavLink href="/categories" extra>
              <Tags {...iconProps} />
              <span>{t("nav.categories")}</span>
            </NavLink>
            <NavLink href="/notifications" extra>
              <Bell {...iconProps} />
              <span>{t("nav.notifications")}</span>
            </NavLink>
            <NavLink href="/settings" extra>
              <Settings {...iconProps} />
              <span>{t("nav.settings")}</span>
            </NavLink>
            <button
              type="button"
              className={`${styles.navItem} ${styles.moreBtn}`}
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
            </button>
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
