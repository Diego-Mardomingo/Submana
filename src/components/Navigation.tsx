"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronRight, Plus } from "lucide-react";
import AddShortcutsOverlay from "@/components/AddShortcutsOverlay";
import {
  AccountsIcon,
  BudgetsIcon,
  CategoriesIcon,
  DashboardIcon,
  FriendsIcon,
  HomeIcon,
  LogoMark,
  MenuIcon,
  NotificationsIcon,
  SettingsIcon,
  SubcountIcon,
  SubscriptionsIcon,
  TransactionsIcon,
} from "@/components/icons";
import { FieldGroup } from "@/components/SheetFields";
import { Sheet, SheetBody } from "@/components/ui/sheet";
import { useLang } from "@/hooks/useLang";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useNotificationCounts } from "@/hooks/useNotifications";
import { useSidebarCollapsed } from "@/hooks/useSidebarCollapsed";
import type { UIKey } from "@/lib/i18n/ui";
import { interpolate, useTranslations } from "@/lib/i18n/utils";
import { getParentRoute } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import styles from "./Navigation.module.css";

const iconProps = { size: 20, strokeWidth: 1.75 };

type NavItem = { href: string; shortcut: string; labelKey: UIKey; icon: React.ComponentType<typeof iconProps> };

/** Keyboard shortcut → page, grouped as in the sidebar and the mobile menu sheet. */
const NAV_GROUPS: Record<"main" | "manage" | "system", NavItem[]> = {
  main: [
    { href: "/", shortcut: "f", labelKey: "nav.home", icon: HomeIcon },
    { href: "/dashboard", shortcut: "d", labelKey: "nav.dashboard", icon: DashboardIcon },
    { href: "/transactions", shortcut: "q", labelKey: "nav.transactions", icon: TransactionsIcon },
  ],
  manage: [
    { href: "/accounts", shortcut: "a", labelKey: "nav.accounts", icon: AccountsIcon },
    { href: "/categories", shortcut: "c", labelKey: "nav.categories", icon: CategoriesIcon },
    { href: "/subscriptions", shortcut: "s", labelKey: "nav.subscriptions", icon: SubscriptionsIcon },
    { href: "/budgets", shortcut: "e", labelKey: "nav.budgets", icon: BudgetsIcon },
    { href: "/subcount", shortcut: "r", labelKey: "nav.groups", icon: SubcountIcon },
  ],
  system: [
    { href: "/friends", shortcut: "g", labelKey: "nav.friends", icon: FriendsIcon },
    { href: "/notifications", shortcut: "z", labelKey: "nav.notifications", icon: NotificationsIcon },
    { href: "/profile", shortcut: "x", labelKey: "nav.settings", icon: SettingsIcon },
  ],
};
const NAV_ITEMS = Object.values(NAV_GROUPS).flat();
const navItem = (href: string) => NAV_ITEMS.find((item) => item.href === href)!;
/** Mobile bar: three tabs left of the +, three right (the last one opens the menu sheet, which lists every page). */
const BAR_LEFT = ["/", "/dashboard", "/transactions"].map(navItem);
const BAR_RIGHT = ["/subcount", "/subscriptions"].map(navItem);
const BAR_HREFS = new Set([...BAR_LEFT, ...BAR_RIGHT].map((item) => item.href));
const ADD_SHORTCUT = "w";
/** Folds and unfolds the desktop sidebar. */
const SIDEBAR_SHORTCUT = "b";

/** Up to 9 the number, beyond that "9+". */
const countLabel = (count: number) => (count > 9 ? "9+" : String(count));

/** Section a route belongs to (an account page lights up "Accounts"). */
function sectionOf(pathname: string) {
  const path = pathname.replace(/\/$/, "") || "/";
  const parent = getParentRoute(path);
  return parent === "/" ? path : parent;
}

/** Already on exactly that page (same path, no query): opening it again just scrolls back to the top. */
function scrollToTopIfCurrent(href: string) {
  const { pathname, search } = window.location;
  if ((pathname.replace(/\/$/, "") || "/") !== href || search) return false;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  return true;
}

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations(useLang());
  const { data: counts } = useNotificationCounts();
  // Unread: the number next to "Notifications". Unseen: what the Menu tab's dot is for (the same as the bell).
  const unread = counts?.unread ?? 0;
  const unseen = counts?.unseen ?? 0;
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addAnchor, setAddAnchor] = useState<DOMRect | null>(null);
  const addBtnRef = useRef<HTMLButtonElement>(null);
  const [collapsed, setCollapsed] = useSidebarCollapsed();
  const { tip, showTip, hideTip, hideTipNow } = useRailTip(collapsed);
  const section = sectionOf(pathname);
  const inMenuSection = NAV_ITEMS.some((item) => item.href === section) && !BAR_HREFS.has(section);

  const openAdd = () => {
    setMenuOpen(false);
    setAddAnchor(addBtnRef.current?.getBoundingClientRect() ?? null);
    setShowAdd(true);
  };

  const toggleSidebar = () => {
    setShowAdd(false);
    hideTipNow();
    setCollapsed(!collapsed);
  };

  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
    if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
    const key = e.key.toLowerCase();
    if (key === SIDEBAR_SHORTCUT) {
      if (isMobile) return;
      e.preventDefault();
      toggleSidebar();
      return;
    }
    const item = NAV_ITEMS.find((n) => n.shortcut === key);
    if (key !== ADD_SHORTCUT && !item) return;
    e.preventDefault();
    if (!item) openAdd();
    else if (!scrollToTopIfCurrent(item.href)) router.push(item.href);
  });
  useEffect(() => {
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const closeAll = () => {
    setMenuOpen(false);
    setShowAdd(false);
  };

  /** Click on a nav link: closes the overlays, and on the page it points to scrolls to the top instead of navigating. */
  const onLinkClick = (href: string) => (e: React.MouseEvent) => {
    closeAll();
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (scrollToTopIfCurrent(href)) e.preventDefault();
  };

  const sidebarLink = ({ href, shortcut, labelKey, icon: Icon }: NavItem) => {
    const unreadHere = href === "/notifications" && unread > 0;
    return (
      <Link
        key={href}
        href={href}
        className={cn(styles.sideItem, section === href && styles.active)}
        aria-current={section === href ? "page" : undefined}
        onClick={onLinkClick(href)}
        data-tip={unreadHere ? `${t(labelKey)} · ${countLabel(unread)}` : t(labelKey)}
        data-tip-key={shortcut.toUpperCase()}
      >
        <Icon {...iconProps} />
        <span className={styles.label}>{t(labelKey)}</span>
        {unreadHere && (
          <>
            <span className={styles.count} aria-label={interpolate(t(unread === 1 ? "bell.label.one" : "bell.label.other"), { count: unread })}>
              {countLabel(unread)}
            </span>
            <span className={styles.countDot} aria-hidden />
          </>
        )}
        <kbd className={styles.kbd}>{shortcut.toUpperCase()}</kbd>
      </Link>
    );
  };

  return (
    <>
      {isMobile ? (
        <nav className={styles.bar} id="main-nav" aria-label={t("nav.menu")}>
          {BAR_LEFT.map(({ href, icon, labelKey }) => (
            <BarTab key={href} href={href} icon={icon} label={t(labelKey)} active={section === href} onClick={onLinkClick(href)} />
          ))}
          <button
            type="button"
            className={cn(styles.notch, showAdd && styles.notchOpen)}
            onClick={() => (showAdd ? setShowAdd(false) : openAdd())}
            aria-label={t(showAdd ? "nav.close" : "nav.add")}
            aria-expanded={showAdd}
          >
            <svg className={styles.notchShape} viewBox="0 0 120 44" preserveAspectRatio="none" aria-hidden>
              <path d="M0 0 C28 0 24 40 60 40 C96 40 92 0 120 0 Z" />
            </svg>
            <Plus className={styles.notchIcon} strokeWidth={2.5} aria-hidden />
          </button>
          {BAR_RIGHT.map(({ href, icon, labelKey }) => (
            <BarTab key={href} href={href} icon={icon} label={t(labelKey)} active={section === href} onClick={onLinkClick(href)} />
          ))}
          <BarTab
            icon={MenuIcon}
            label={t("nav.menu")}
            active={menuOpen || (inMenuSection && !showAdd)}
            dot={unseen > 0}
            onClick={() => {
              setShowAdd(false);
              setMenuOpen(true);
            }}
          />
        </nav>
      ) : (
        <nav
          className={styles.sidebar}
          id="main-nav"
          onPointerOver={(e) => {
            if (e.pointerType === "mouse") showTip((e.target as HTMLElement).closest<HTMLElement>("[data-tip]"));
          }}
          onPointerLeave={hideTip}
          onPointerDown={hideTipNow}
          onScroll={hideTipNow}
          onFocus={(e) => {
            const el = (e.target as HTMLElement).closest<HTMLElement>("[data-tip]");
            if (el?.matches(":focus-visible")) showTip(el);
          }}
          onBlur={hideTip}
        >
          <div className={styles.brandRow}>
            <Link href="/" className={styles.brand} onClick={onLinkClick("/")} aria-label="Submana">
              <span className={styles.brandMark}>
                <LogoMark />
              </span>
              <span className={styles.brandName}>Submana</span>
            </Link>
            <button
              type="button"
              className={styles.collapseBtn}
              onClick={toggleSidebar}
              aria-controls="main-nav"
              aria-expanded={!collapsed}
              aria-label={t(collapsed ? "nav.expand" : "nav.collapse")}
              aria-keyshortcuts={SIDEBAR_SHORTCUT.toUpperCase()}
              data-tip={t(collapsed ? "nav.expand" : "nav.collapse")}
              data-tip-key={SIDEBAR_SHORTCUT.toUpperCase()}
              data-tip-always=""
            >
              <SidebarIcon />
            </button>
          </div>
          <button
            ref={addBtnRef}
            type="button"
            className={cn(styles.addBtn, showAdd && styles.addBtnOpen)}
            onClick={() => (showAdd ? setShowAdd(false) : openAdd())}
            aria-expanded={showAdd}
            aria-label={t("nav.add")}
            data-tip={t("nav.add")}
            data-tip-key={ADD_SHORTCUT.toUpperCase()}
          >
            <Plus className={styles.addIcon} size={18} strokeWidth={2.5} aria-hidden />
            <span className={styles.label}>{t("nav.add")}</span>
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
            {(["main", "manage", "system"] as const).map((group) => (
              <FieldGroup key={group} title={group === "manage" ? t("nav.manage") : undefined}>
                {NAV_GROUPS[group].map(({ href, labelKey, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className={cn("sf-row sf-action", styles.menuRow, section === href && styles.active)}
                    aria-current={section === href ? "page" : undefined}
                    onClick={onLinkClick(href)}
                  >
                    <span className={styles.menuIcon}>
                      <Icon {...iconProps} />
                    </span>
                    <span>{t(labelKey)}</span>
                    {href === "/notifications" && unread > 0 && (
                      <span className={cn(styles.count, styles.menuCount)} aria-label={interpolate(t(unread === 1 ? "bell.label.one" : "bell.label.other"), { count: unread })}>
                        {countLabel(unread)}
                      </span>
                    )}
                    <ChevronRight className={styles.menuChevron} aria-hidden />
                  </Link>
                ))}
              </FieldGroup>
            ))}
          </SheetBody>
        </Sheet>
      )}

      {!isMobile && (
        <span className={styles.railTip} data-open={tip.open} data-glide={tip.glide} style={{ top: tip.top }} aria-hidden>
          {tip.label}
          {tip.keyHint && <kbd>{tip.keyHint}</kbd>}
        </span>
      )}

      <AddShortcutsOverlay open={showAdd} anchor={isMobile ? null : addAnchor} onClose={() => setShowAdd(false)} />
    </>
  );
}

/** Panel icon whose chevron turns round as the sidebar folds (styles.collapseChevron). */
function SidebarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M9 3v18" />
      <path className={styles.collapseChevron} d="m16 15-3-3 3-3" />
    </svg>
  );
}

type RailTip = { label: string; keyHint?: string; top: number; open: boolean; glide: boolean };

/**
 * The name and key of the sidebar item under the pointer (or keyboard focus), beside the rail. Only while folded,
 * except for elements with data-tip-always. The first one waits a moment; moving to the next one while it is open
 * is instant, and the tip glides there.
 */
function useRailTip(collapsed: boolean) {
  const [tip, setTip] = useState<RailTip>({ label: "", top: 0, open: false, glide: false });
  const open = useRef(false);
  const timer = useRef<number | undefined>(undefined);

  const hideTipNow = () => {
    window.clearTimeout(timer.current);
    open.current = false;
    setTip((prev) => (prev.open ? { ...prev, open: false, glide: false } : prev));
  };
  // A short grace period, so crossing the gap between two items doesn't close it.
  const hideTip = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(hideTipNow, 90);
  };
  const showTip = (el: HTMLElement | null) => {
    if (!el?.dataset.tip || (!collapsed && el.dataset.tipAlways === undefined)) return hideTip();
    window.clearTimeout(timer.current);
    const place = () => {
      const r = el.getBoundingClientRect();
      const glide = open.current;
      open.current = true;
      setTip({ label: el.dataset.tip!, keyHint: el.dataset.tipKey, top: r.top + r.height / 2, open: true, glide });
    };
    if (open.current) place();
    else timer.current = window.setTimeout(place, 260);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return { tip, showTip, hideTip, hideTipNow };
}

/** Mobile bar tab: icon only, with its label shown while active. A link, or a button without `href`. */
function BarTab({ href, icon: Icon, label, active, dot, onClick }: { href?: string; icon: NavItem["icon"]; label: string; active: boolean; /** Something new to look at (an accent dot on the icon). */ dot?: boolean; onClick: (e: React.MouseEvent) => void }) {
  const className = cn(styles.tab, active && styles.active);
  const content = (
    <>
      <span className={styles.tabIcon}>
        <Icon {...iconProps} />
        {dot && <span className={styles.tabDot} aria-hidden />}
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
