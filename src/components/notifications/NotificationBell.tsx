"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence } from "framer-motion";
import { useLang } from "@/hooks/useLang";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { prefetchNotifications, useNotificationCounts } from "@/hooks/useNotifications";
import { interpolate, useTranslations } from "@/lib/i18n/utils";
import { BellButton, resetBellSession } from "./BellButton";
import styles from "./NotificationBell.module.css";

const INBOX_UNREAD_URL = "/notifications?filter=unread";

/**
 * What the bell shows: the notifications the user has not seen yet ("seen" model: opening the inbox switches
 * the bell off, they stay unread until tapped). Zero while it must be hidden, so it plays its exit.
 * `announcement` goes to a polite live region when new ones arrive.
 */
function useBellModel(enabled: boolean) {
  const t = useTranslations(useLang());
  const { data } = useNotificationCounts();
  const unseen = data?.unseen ?? 0;
  const count = enabled ? unseen : 0;
  const [previous, setPrevious] = useState(count);
  const [announcement, setAnnouncement] = useState("");
  if (count !== previous) {
    setPrevious(count);
    const added = count - previous;
    setAnnouncement(added <= 0 ? "" : added === 1 ? t("bell.new.one") : interpolate(t("bell.new.other"), { count: added }));
  }
  useEffect(() => {
    if (count === 0) resetBellSession();
  }, [count]);
  return { count, announcement };
}

/**
 * The bell opens the inbox with `router.push`, which `<Link>` would prefetch but a button does not: without this,
 * a tap waited for the route's server payload, then its JS chunk, then the list, before anything changed.
 * While the bell shows, the route and the first page of unread notifications load ahead of time, again when the
 * count changes (the realtime sync marks the list stale); `prefetch` (on pointerdown) tops them up if they were
 * evicted. Both are no-ops while cached.
 */
function usePrefetchInbox(count: number) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const prefetch = useCallback(() => {
    router.prefetch(INBOX_UNREAD_URL);
    void prefetchNotifications(queryClient, "unread");
  }, [router, queryClient]);
  useEffect(() => {
    if (count > 0) prefetch();
  }, [count, prefetch]);
  return prefetch;
}

/** Whether the pathname is the inbox, where the bell is never shown. */
const inInbox = (pathname: string | null) => !!pathname && (pathname === "/notifications" || pathname.startsWith("/notifications/"));

/** Phones: the bell floats bottom-right above the bottom bar (mounted once in the authenticated layout). */
export function NotificationBell() {
  const router = useRouter();
  const pathname = usePathname();
  const isPhone = useMediaQuery("(max-width: 767px)");
  const { count, announcement } = useBellModel(isPhone && !inInbox(pathname));
  const prefetch = usePrefetchInbox(count);
  if (!isPhone) return null;
  return (
    <div className={styles.floating}>
      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
      <AnimatePresence>{count > 0 && <BellButton key="bell" count={count} onPointerDown={prefetch} onClick={() => router.push(INBOX_UNREAD_URL)} />}</AnimatePresence>
    </div>
  );
}

/**
 * From tablet up: the bell lives inside the page header, to the left of its actions (every header component
 * includes it). Renders nothing on phones (there the floating bell is used), in the inbox, or with nothing pending.
 */
export function HeaderBell() {
  const router = useRouter();
  const pathname = usePathname();
  const isWide = useMediaQuery("(min-width: 768px)");
  const { count, announcement } = useBellModel(isWide && !inInbox(pathname));
  const prefetch = usePrefetchInbox(count);
  if (!isWide) return null;
  return (
    <>
      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
      <AnimatePresence>{count > 0 && <BellButton key="bell" small count={count} onPointerDown={prefetch} onClick={() => router.push(INBOX_UNREAD_URL)} />}</AnimatePresence>
    </>
  );
}
