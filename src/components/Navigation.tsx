"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useCallback } from "react";
import { useLang } from "@/hooks/useLang";
import { useTranslations } from "@/lib/i18n/utils";
import styles from "./Navigation.module.css";

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
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <span className={styles.submanaText}>Submana</span>
              </div>
            </Link>
          </div>
          <div className={styles.navItemsWrapper}>
            <NavLink href="/">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              <span>{t("nav.home")}</span>
            </NavLink>
            <NavLink href="/subscriptions">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span>{t("nav.subscriptions")}</span>
            </NavLink>
            <NavLink href="/accounts" extra>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                <line x1="1" y1="10" x2="23" y2="10" />
              </svg>
              <span>{t("nav.accounts")}</span>
            </NavLink>
            <NavLink href="/transactions">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 21v-16a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v16l-3 -2l-2 2l-2 -2l-2 2l-2 -2l-3 2" />
                <path d="M15 7.8c-.523 -.502 -1.172 -.8 -1.875 -.8c-1.727 0 -3.125 1.791 -3.125 4s1.398 4 3.125 4c.703 0 1.352 -.298 1.874 -.8" />
                <path d="M9 11h4" />
              </svg>
              <span>{t("nav.transactions")}</span>
            </NavLink>
            <NavLink href="/categories" extra>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 9h16" />
                <path d="M4 15h16" />
                <path d="M10 3L8 21" />
                <path d="M16 3l-2 18" />
              </svg>
              <span>{t("nav.categories")}</span>
            </NavLink>
            <NavLink href="/notifications" extra>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <span>{t("nav.notifications")}</span>
            </NavLink>
            <NavLink href="/settings" extra>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              <span>{t("nav.settings")}</span>
            </NavLink>
            <button
              type="button"
              className={`${styles.navItem} ${styles.moreBtn}`}
              onClick={() => setExpanded((e) => !e)}
              aria-label={t("nav.menu")}
            >
              <div className={styles.iconContainer}>
                <svg className={styles.iconMenu} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m17 11-5-5-5 5" />
                  <path d="m17 18-5-5-5 5" />
                </svg>
                <svg className={styles.iconClose} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
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
