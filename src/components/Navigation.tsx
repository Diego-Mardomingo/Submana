"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Plus } from "lucide-react";
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
import { Sheet, SheetBody } from "@/components/ui/sheet";
import { useCompactOnScroll } from "@/hooks/useCompactOnScroll";
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
/** Mobile dock: two tabs either side of the +; the last one ("More") opens a sheet with every other page. */
const BAR_LEFT = ["/", "/transactions"].map(navItem);
const BAR_RIGHT = ["/subcount"].map(navItem);
const BAR_HREFS = new Set([...BAR_LEFT, ...BAR_RIGHT].map((item) => item.href));
/** The "More" sheet: the pages without a tab, in the sidebar's order. */
const MORE_ITEMS = NAV_ITEMS.filter((item) => !BAR_HREFS.has(item.href));
/** Shorter tab names where the page's own name doesn't fit a quarter of the dock. */
const TAB_LABELS: Partial<Record<string, UIKey>> = { "/transactions": "nav.transactionsTab" };
/** Position of each dock tab ("More" is the last one), and how many sit left of the +. */
const DOCK_TABS = [...BAR_LEFT.map((item) => item.href), ...BAR_RIGHT.map((item) => item.href), "more"];
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
  const moreActive = menuOpen || (inMenuSection && !showAdd);
  const [compact, setCompact] = useCompactOnScroll({ enabled: isMobile, resetKey: pathname });
  // The pill under the active tab: its column among the four, and whether it sits right of the +.
  const pillAt = DOCK_TABS.indexOf(moreActive ? "more" : section);
  const pillRef = useRef<HTMLSpanElement>(null);
  const lastPillAt = useRef(pillAt);
  // Moving to another tab replays the pill's stretch (not when it just appears or hides).
  useEffect(() => {
    const from = lastPillAt.current;
    lastPillAt.current = pillAt;
    const pill = pillRef.current;
    if (!pill || from === pillAt || from < 0 || pillAt < 0) return;
    pill.removeAttribute("data-travel");
    void pill.offsetWidth;
    pill.setAttribute("data-travel", "");
  }, [pillAt]);

  const openAdd = () => {
    setMenuOpen(false);
    setCompact(false);
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
    if (scrollToTopIfCurrent(href)) {
      e.preventDefault();
      setCompact(false);
    }
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
        <nav
          className={styles.dock}
          id="main-nav"
          aria-label={t("nav.menu")}
          data-compact={compact}
          style={{ "--i": Math.max(pillAt, 0), "--after": pillAt >= BAR_LEFT.length ? 1 : 0 } as React.CSSProperties}
        >
          <span ref={pillRef} className={styles.dockPill} data-hidden={pillAt < 0} onAnimationEnd={(e) => e.currentTarget.removeAttribute("data-travel")} aria-hidden />
          {BAR_LEFT.map(({ href, icon, labelKey }) => (
            <DockTab key={href} href={href} icon={icon} label={t(TAB_LABELS[href] ?? labelKey)} active={section === href} onClick={onLinkClick(href)} />
          ))}
          <button
            type="button"
            className={styles.dockDrop}
            onClick={() => (showAdd ? setShowAdd(false) : openAdd())}
            aria-label={t(showAdd ? "nav.close" : "nav.add")}
            aria-expanded={showAdd}
          >
            <svg className={styles.dockDropShape} viewBox="0 0 120 44" preserveAspectRatio="none" aria-hidden>
              <path d="M0 0 C28 0 24 40 60 40 C96 40 92 0 120 0 Z" />
            </svg>
            <Plus className={styles.dockDropIcon} strokeWidth={2.5} aria-hidden />
          </button>
          {BAR_RIGHT.map(({ href, icon, labelKey }) => (
            <DockTab key={href} href={href} icon={icon} label={t(TAB_LABELS[href] ?? labelKey)} active={section === href} onClick={onLinkClick(href)} />
          ))}
          <DockTab
            icon={MenuIcon}
            label={t("nav.more")}
            active={moreActive}
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
        <Sheet open={menuOpen} onOpenChange={setMenuOpen} title={t("nav.more")}>
          <SheetBody className={styles.menuBody}>
            <div className={styles.moreGrid}>
              {MORE_ITEMS.map(({ href, labelKey, icon: Icon }, i) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(styles.moreTile, section === href && styles.active)}
                  style={{ "--i": i } as React.CSSProperties}
                  aria-current={section === href ? "page" : undefined}
                  onClick={onLinkClick(href)}
                >
                  <span className={styles.moreIcon}>
                    <Icon size={22} strokeWidth={1.75} />
                  </span>
                  <span className={styles.moreLabel}>{t(labelKey)}</span>
                  {href === "/notifications" && unread > 0 && (
                    <span className={cn(styles.count, styles.moreCount)} aria-label={interpolate(t(unread === 1 ? "bell.label.one" : "bell.label.other"), { count: unread })}>
                      {countLabel(unread)}
                    </span>
                  )}
                </Link>
              ))}
            </div>
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

/**
 * Mobile dock tab: icon and name, both always visible (only the icon while the dock is compact). The icon's tinted
 * detail fills in while active, and it bounces when tapped. A link, or a button without `href`.
 */
function DockTab({ href, icon: Icon, label, active, dot, onClick }: { href?: string; icon: NavItem["icon"]; label: string; active: boolean; /** Something new to look at (an accent dot on the icon). */ dot?: boolean; onClick: (e: React.MouseEvent) => void }) {
  const ref = useRef<HTMLAnchorElement & HTMLButtonElement>(null);
  const handleClick = (e: React.MouseEvent) => {
    const el = ref.current;
    if (el) {
      // Restart the bounce even when tapping the same tab twice in a row.
      el.removeAttribute("data-bounce");
      void el.offsetWidth;
      el.setAttribute("data-bounce", "");
    }
    onClick(e);
  };
  const content = (
    <>
      <span className={styles.dockIcon} onAnimationEnd={() => ref.current?.removeAttribute("data-bounce")}>
        <Icon size={24} strokeWidth={1.75} />
        {dot && <span className={styles.dockDot} aria-hidden />}
      </span>
      <span className={styles.dockLabel}>{label}</span>
    </>
  );
  return href ? (
    <Link ref={ref} href={href} className={styles.dockTab} aria-current={active ? "page" : undefined} onClick={handleClick}>
      {content}
    </Link>
  ) : (
    <button ref={ref} type="button" className={styles.dockTab} data-active={active || undefined} aria-haspopup="dialog" onClick={handleClick}>
      {content}
    </button>
  );
}
