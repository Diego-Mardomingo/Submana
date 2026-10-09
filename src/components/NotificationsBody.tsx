"use client";

import { useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bell, CheckCheck, Settings2 } from "lucide-react";
import { CompactPageHeader } from "@/components/PageHeader";
import { NotificationRow } from "@/components/notifications/NotificationRow";
import { Segmented, SheetButton } from "@/components/SheetFields";
import { SwipeToRevealGroup } from "@/components/SwipeToReveal";
import {
  removeFromNotificationPages,
  useMarkAllRead,
  useMarkRead,
  useMarkSeen,
  useNotificationCounts,
  useNotifications,
  type NotificationPages,
} from "@/hooks/useNotifications";
import { useLang } from "@/hooks/useLang";
import { useUndoableDelete } from "@/hooks/useUndoableDelete";
import { api } from "@/lib/api";
import { localeOf } from "@/lib/format";
import type { UIKey } from "@/lib/i18n/ui";
import { useTranslations } from "@/lib/i18n/utils";
import { safeInternalPath } from "@/lib/navigation";
import { isNotificationType, notificationDef } from "@/lib/notifications/catalog";
import { groupByDay, notificationTimeLabel } from "@/lib/notifications/inbox";
import type { NotificationFilter, NotificationItem } from "@/lib/notifications/types";
import { queryKeys } from "@/lib/queryKeys";
import { toast } from "@/lib/toast";
import styles from "@/components/notifications/NotificationsInbox.module.css";

/** Where tapping a notification goes: the url stored with it, or the one its type builds from its params. */
function linkOf(item: NotificationItem): string | null {
  if (item.url) return item.url;
  return isNotificationType(item.type) ? notificationDef(item.type).url(item.params as never) : null;
}

/**
 * The inbox: notifications grouped by day, newest first. `?filter=unread` (the bell links to it) shows only the
 * unread ones; without the param it shows all. Opening it marks the bell as seen (the notifications stay unread
 * until tapped or "Mark all as read").
 */
export default function NotificationsBody() {
  const lang = useLang();
  const t = useTranslations(lang);
  const router = useRouter();
  const pathname = usePathname();
  const filter: NotificationFilter = useSearchParams().get("filter") === "unread" ? "unread" : "all";
  const { data, isLoading, isError, hasNextPage, fetchNextPage, isFetchingNextPage } = useNotifications(filter);
  const { data: counts } = useNotificationCounts();
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();
  const { mutate: markSeen } = useMarkSeen();
  const undoableDelete = useUndoableDelete();

  const unread = counts?.unread ?? 0;
  const unseen = counts?.unseen ?? 0;
  const countsLoaded = !!counts;
  // "Seen" model: being in the inbox is what switches the bell off, also for what arrives while it is open.
  useEffect(() => {
    if (!countsLoaded || unseen > 0) markSeen();
  }, [countsLoaded, unseen, markSeen]);

  const items = useMemo(() => data?.pages.flatMap((page) => page.items) ?? [], [data]);
  const groups = useMemo(() => groupByDay(items), [items]);
  const locale = localeOf(lang);

  const setFilter = (next: NotificationFilter) => router.replace(next === "unread" ? `${pathname}?filter=unread` : pathname, { scroll: false });

  const open = useCallback(
    (item: NotificationItem) => {
      if (item.read_at == null) markRead.mutate({ id: item.id, read: true });
      const link = linkOf(item);
      if (link) router.push(safeInternalPath(link, "/"));
    },
    [markRead, router]
  );
  const toggleRead = useCallback((item: NotificationItem) => markRead.mutate({ id: item.id, read: item.read_at == null }), [markRead]);
  const answered = useCallback(
    (item: NotificationItem) => {
      if (item.read_at == null) markRead.mutate({ id: item.id, read: true });
    },
    [markRead]
  );
  const remove = useCallback(
    (item: NotificationItem) =>
      undoableDelete({
        title: "notifications.deleted",
        edits: [{ queryKey: queryKeys.notifications.lists(), remove: (pages: NotificationPages) => removeFromNotificationPages(pages, item.id) }],
        commit: (init) => api(`/api/notifications/${item.id}`, "DELETE", undefined, init),
        invalidate: [queryKeys.notifications.lists(), queryKeys.notifications.counts()],
      }),
    [undoableDelete]
  );

  return (
    <div className="page-container lp-page fade-in">
      <CompactPageHeader title={t("notifications.title")} />

      <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
        <div className={styles.toolbar}>
          <div className={styles.filter}>
            <Segmented
              label={t("notifications.title")}
              value={filter}
              onChange={setFilter}
              options={[
                { value: "unread", label: `${t("notifications.filter.unread")}${unread > 0 ? ` · ${unread > 99 ? "99+" : unread}` : ""}` },
                { value: "all", label: t("notifications.filter.all") },
              ]}
            />
          </div>
          <div className={styles.toolbarEnd}>
            <button
              type="button"
              className={styles.markAll}
              disabled={unread === 0 || markAllRead.isPending}
              onClick={() => markAllRead.mutate(undefined, { onSuccess: () => toast.success(t("notifications.allMarkedRead")) })}
            >
              {t("notifications.markAllRead")}
            </button>
            <Link href="/profile#notifications" className="lp-icon-btn" aria-label={t("notifications.settings")} title={t("notifications.settings")}>
              <Settings2 className="size-5" />
            </Link>
          </div>
        </div>

        {isLoading ? (
          <div className="lp-card lp-group" aria-hidden>
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="lp-skeleton-row">
                <div className="skeleton" />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                  <div className="skeleton" style={{ height: 12, width: "65%" }} />
                  <div className="skeleton" style={{ height: 10, width: "40%" }} />
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="lp-card lp-empty">
            <p className="lp-empty-text">{t("notifications.loadError")}</p>
          </div>
        ) : items.length === 0 ? (
          <div className="lp-card lp-empty">
            <div className="lp-empty-icon">{filter === "unread" ? <CheckCheck /> : <Bell />}</div>
            <p className="lp-empty-title">{t(filter === "unread" ? "notifications.emptyUnread" : "notifications.empty")}</p>
            <p className="lp-empty-text">{t(filter === "unread" ? "notifications.emptyUnreadDesc" : "notifications.emptyDesc")}</p>
            {filter === "unread" && (
              <button type="button" className="lp-chip" onClick={() => setFilter("all")}>
                {t("notifications.filter.all")}
              </button>
            )}
          </div>
        ) : (
          <>
            {groups.map(({ key, items: groupItems }) => (
              <section key={key} className="lp-section">
                <div className="lp-section-head">
                  <span className="lp-section-title">{t(`notifications.group.${key}` as UIKey)}</span>
                </div>
                <SwipeToRevealGroup className="lp-card lp-group">
                  {groupItems.map((item) => (
                    <NotificationRow
                      key={item.id}
                      item={item}
                      timeLabel={notificationTimeLabel(item.created_at, key, locale)}
                      onOpen={open}
                      onToggleRead={toggleRead}
                      onDelete={remove}
                      onAnswered={answered}
                    />
                  ))}
                </SwipeToRevealGroup>
              </section>
            ))}
            {hasNextPage && (
              <SheetButton type="button" variant="ghost" pending={isFetchingNextPage} onClick={() => fetchNextPage()}>
                {t("notifications.loadMore")}
              </SheetButton>
            )}
          </>
        )}
      </div>
    </div>
  );
}
