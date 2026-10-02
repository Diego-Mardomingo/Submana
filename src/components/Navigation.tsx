"use client";

import { useEffect, useEffectEvent, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Calendar, ChevronDown, ChevronUp, CreditCard, House, LayoutDashboard, Plus, Settings, Tags, Wallet } from "lucide-react";
import AddShortcutsOverlay from "@/components/AddShortcutsOverlay";
import { LogoMark, TransactionsIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useLang } from "@/hooks/useLang";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import type { UIKey } from "@/lib/i18n/ui";
import { useTranslations } from "@/lib/i18n/utils";
import { cn } from "@/lib/utils";
import styles from "./Navigation.module.css";

const iconProps = { size: 20, strokeWidth: 1.5 };

/** Keyboard shortcut → page. "Extra" items only show in the expanded mobile menu. */
const NAV_ITEMS: { href: string; shortcut: string; labelKey: UIKey; icon: React.ComponentType<typeof iconProps>; extra?: boolean }[] = [
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
const ADD_SHORTCUT = "w";

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations(useLang());
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [expanded, setExpanded] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const currentPath = pathname === "/" ? "/" : pathname.replace(/\/$/, "");

  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
    const key = e.key.toLowerCase();
    const item = NAV_ITEMS.find((n) => n.shortcut === key);
    if (key !== ADD_SHORTCUT && !item) return;
    e.preventDefault();
    if (item) router.push(item.href);
    else setShowAdd(true);
  });
  useEffect(() => {
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const navLink = ({ href, shortcut, labelKey, icon: Icon, extra }: (typeof NAV_ITEMS)[number]) => (
    <Link
      key={href}
      href={href}
      className={cn(styles.navItem, currentPath === href && styles.active, extra && styles.extraItem)}
      onClick={() => {
        setExpanded(false);
        setShowAdd(false);
      }}
    >
      <Icon {...iconProps} />
      <span>{t(labelKey)}</span>
      <kbd className={styles.shortcutBadge}>{shortcut.toUpperCase()}</kbd>
    </Link>
  );

  const menuLabel = t(expanded ? "nav.close" : "nav.menu");
  const menuButton = (
    <Button
      type="button"
      variant="ghost"
      className={cn(styles.navItem, styles.moreBtn)}
      onClick={() => {
        setShowAdd(false);
        setExpanded((e) => !e);
      }}
      aria-label={t("nav.menu")}
    >
      <div className={styles.iconContainer}>{expanded ? <ChevronDown {...iconProps} /> : <ChevronUp {...iconProps} />}</div>
      <span>{menuLabel}</span>
    </Button>
  );
  const compactMobile = isMobile && !expanded;

  return (
    <>
      <nav className={cn(styles.navigation, expanded && styles.expanded)} id="main-nav">
        <div className={styles.navContent}>
          <div className={styles.logoContainer}>
            <Link href="/" className={styles.logoLink}>
              <div className={styles.logoInner}>
                <div className={styles.logoIcon}>
                  <LogoMark />
                </div>
                <span className={styles.submanaText}>Submana</span>
              </div>
            </Link>
          </div>
          <div className={cn(styles.navItemsWrapper, compactMobile && styles.navItemsWrapperWithNotch)}>
            {compactMobile ? (
              <>
                {NAV_ITEMS.slice(0, 2).map(navLink)}
                <button type="button" className={styles.navNotch} onClick={() => setShowAdd(true)} aria-label="Add">
                  <svg className={styles.navNotchShape} viewBox="0 0 120 56" xmlns="http://www.w3.org/2000/svg">
                    <path d="M0 0 C28 0 24 40 60 40 C96 40 92 0 120 0 Z" fill="var(--accent)" />
                  </svg>
                  <Plus className={styles.navNotchIcon} strokeWidth={2.5} />
                </button>
                {navLink(NAV_ITEMS[2])}
                {menuButton}
              </>
            ) : (
              <>
                {!isMobile && (
                  <button type="button" className={cn("add-btn", styles.navAddBtn)} onClick={() => setShowAdd(true)} aria-label={t("nav.add")}>
                    <Plus className="h-5 w-5" strokeWidth={2.5} />
                    <span>{t("nav.add")}</span>
                    <kbd className={styles.shortcutBadge}>W</kbd>
                  </button>
                )}
                {NAV_ITEMS.map(navLink)}
                {menuButton}
              </>
            )}
          </div>
        </div>
      </nav>
      <div
        className={cn(styles.navBackdrop, expanded && styles.visible)}
        onClick={() => setExpanded(false)}
        onKeyDown={(e) => e.key === "Escape" && setExpanded(false)}
        role="button"
        tabIndex={0}
        aria-label="Close menu"
      />
      {showAdd && <AddShortcutsOverlay onClose={() => setShowAdd(false)} />}
    </>
  );
}
