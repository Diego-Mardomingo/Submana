"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Calendar, ChevronRight, CreditCard, House, LayoutDashboard, Menu, Plus, Settings, Tags, Wallet } from "lucide-react";
import AddShortcutsOverlay from "@/components/AddShortcutsOverlay";
import { LogoMark, TransactionsIcon } from "@/components/icons";
import { FieldGroup } from "@/components/SheetFields";
import { Sheet, SheetBody } from "@/components/ui/sheet";
import { useLang } from "@/hooks/useLang";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import type { UIKey } from "@/lib/i18n/ui";
import { useTranslations } from "@/lib/i18n/utils";
import { getParentRoute } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import styles from "./Navigation.module.css";

const iconProps = { size: 20, strokeWidth: 1.75 };

type NavItem = { href: string; shortcut: string; labelKey: UIKey; icon: React.ComponentType<typeof iconProps> };

/** Keyboard shortcut → page. `main` sits in the mobile bar; the rest open from its menu sheet. */
const NAV_GROUPS: Record<"main" | "manage" | "system", NavItem[]> = {
  main: [
    { href: "/", shortcut: "f", labelKey: "nav.home", icon: House },
    { href: "/dashboard", shortcut: "d", labelKey: "nav.dashboard", icon: LayoutDashboard },
    { href: "/transactions", shortcut: "q", labelKey: "nav.transactions", icon: TransactionsIcon },
  ],
  manage: [
    { href: "/accounts", shortcut: "a", labelKey: "nav.accounts", icon: CreditCard },
    { href: "/categories", shortcut: "c", labelKey: "nav.categories", icon: Tags },
    { href: "/subscriptions", shortcut: "s", labelKey: "nav.subscriptions", icon: Calendar },
    { href: "/budgets", shortcut: "e", labelKey: "nav.budgets", icon: Wallet },
  ],
  system: [
    { href: "/notifications", shortcut: "z", labelKey: "nav.notifications", icon: Bell },
    { href: "/settings", shortcut: "x", labelKey: "nav.settings", icon: Settings },
  ],
};
const NAV_ITEMS = Object.values(NAV_GROUPS).flat();
const MENU_ITEMS = [...NAV_GROUPS.manage, ...NAV_GROUPS.system];
const ADD_SHORTCUT = "w";

/** Section a route belongs to (an account page lights up "Accounts"). */
function sectionOf(pathname: string) {
  const path = pathname.replace(/\/$/, "") || "/";
  const parent = getParentRoute(path);
  return parent === "/" ? path : parent;
}

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations(useLang());
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addAnchor, setAddAnchor] = useState<DOMRect | null>(null);
  const addBtnRef = useRef<HTMLButtonElement>(null);
  const section = sectionOf(pathname);
  const inMenuSection = MENU_ITEMS.some((item) => item.href === section);

  const openAdd = () => {
    setMenuOpen(false);
    setAddAnchor(addBtnRef.current?.getBoundingClientRect() ?? null);
    setShowAdd(true);
  };

  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
    if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
    const key = e.key.toLowerCase();
    const item = NAV_ITEMS.find((n) => n.shortcut === key);
    if (key !== ADD_SHORTCUT && !item) return;
    e.preventDefault();
    if (item) router.push(item.href);
    else openAdd();
  });
  useEffect(() => {
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const closeAll = () => {
    setMenuOpen(false);
    setShowAdd(false);
  };

  const sidebarLink = ({ href, shortcut, labelKey, icon: Icon }: NavItem) => (
    <Link
      key={href}
      href={href}
      className={cn(styles.sideItem, section === href && styles.active)}
      aria-current={section === href ? "page" : undefined}
      onClick={closeAll}
    >
      <Icon {...iconProps} />
      <span>{t(labelKey)}</span>
      <kbd className={styles.kbd}>{shortcut.toUpperCase()}</kbd>
    </Link>
  );

  return (
    <>
      {isMobile ? (
        <nav className={styles.bar} id="main-nav" aria-label={t("nav.menu")}>
          {NAV_GROUPS.main.slice(0, 2).map(({ href, icon, labelKey }) => (
            <BarTab key={href} href={href} icon={icon} label={t(labelKey)} active={section === href} onClick={closeAll} />
          ))}
          <button
            type="button"
            className={cn(styles.notch, showAdd && styles.notchOpen)}
            onClick={() => (showAdd ? setShowAdd(false) : openAdd())}
            aria-label={t(showAdd ? "nav.close" : "nav.add")}
            aria-expanded={showAdd}
          >
            <svg className={styles.notchShape} viewBox="0 0 120 44" aria-hidden>
              <path d="M0 0 C28 0 24 40 60 40 C96 40 92 0 120 0 Z" />
            </svg>
            <Plus className={styles.notchIcon} strokeWidth={2.5} aria-hidden />
          </button>
          <BarTab href="/transactions" icon={TransactionsIcon} label={t("nav.transactions")} active={section === "/transactions"} onClick={closeAll} />
          <BarTab
            icon={Menu}
            label={t("nav.menu")}
            active={menuOpen || (inMenuSection && !showAdd)}
            onClick={() => {
              setShowAdd(false);
              setMenuOpen(true);
            }}
          />
        </nav>
      ) : (
        <nav className={styles.sidebar} id="main-nav">
          <Link href="/" className={styles.brand} onClick={closeAll}>
            <span className={styles.brandMark}>
              <LogoMark />
            </span>
            <span className={styles.brandName}>Submana</span>
          </Link>
          <button
            ref={addBtnRef}
            type="button"
            className={cn(styles.addBtn, showAdd && styles.addBtnOpen)}
            onClick={() => (showAdd ? setShowAdd(false) : openAdd())}
            aria-expanded={showAdd}
          >
            <Plus className={styles.addIcon} size={18} strokeWidth={2.5} aria-hidden />
            <span>{t("nav.add")}</span>
            <kbd className={styles.kbd}>W</kbd>
          </button>
          <div className={styles.sideGroup}>{NAV_GROUPS.main.map(sidebarLink)}</div>
          <div className={styles.sideGroup}>
            <span className={styles.sideHeading}>{t("nav.manage")}</span>
            {NAV_GROUPS.manage.map(sidebarLink)}
          </div>
          <div className={cn(styles.sideGroup, styles.sideFooter)}>{NAV_GROUPS.system.map(sidebarLink)}</div>
        </nav>
      )}

      {isMobile && (
        <Sheet open={menuOpen} onOpenChange={setMenuOpen} title={t("nav.menu")}>
          <SheetBody className={styles.menuBody}>
            {(["manage", "system"] as const).map((group) => (
              <FieldGroup key={group} title={group === "manage" ? t("nav.manage") : undefined}>
                {NAV_GROUPS[group].map(({ href, labelKey, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className={cn("sf-row sf-action", styles.menuRow, section === href && styles.active)}
                    aria-current={section === href ? "page" : undefined}
                    onClick={closeAll}
                  >
                    <span className={styles.menuIcon}>
                      <Icon {...iconProps} />
                    </span>
                    <span>{t(labelKey)}</span>
                    <ChevronRight className={styles.menuChevron} aria-hidden />
                  </Link>
                ))}
              </FieldGroup>
            ))}
          </SheetBody>
        </Sheet>
      )}

      <AddShortcutsOverlay open={showAdd} anchor={isMobile ? null : addAnchor} onClose={() => setShowAdd(false)} />
    </>
  );
}

/** Mobile bar tab: icon only, with its label shown while active. A link, or a button without `href`. */
function BarTab({ href, icon: Icon, label, active, onClick }: { href?: string; icon: NavItem["icon"]; label: string; active: boolean; onClick: () => void }) {
  const className = cn(styles.tab, active && styles.active);
  const content = (
    <>
      <span className={styles.tabIcon}>
        <Icon {...iconProps} />
      </span>
      <span className={styles.tabLabel}>{label}</span>
    </>
  );
  return href ? (
    <Link href={href} className={className} aria-label={label} aria-current={active ? "page" : undefined} onClick={onClick}>
      {content}
    </Link>
  ) : (
    <button type="button" className={className} aria-label={label} aria-haspopup="dialog" onClick={onClick}>
      {content}
    </button>
  );
}
