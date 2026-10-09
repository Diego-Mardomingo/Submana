"use client";

import { memo, useState } from "react";
import { Bell, Check, ChartColumn, FileUp, HandCoins, Landmark, Mail, MailOpen, Receipt, Repeat, Target, Trash2, UserPlus, type LucideIcon } from "lucide-react";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { SensitiveAmount } from "@/components/SensitiveAmount";
import { SwipeToReveal } from "@/components/SwipeToReveal";
import { useAccountInvites, useRespondAccountInvite } from "@/hooks/useAccounts";
import { useRespondFriendRequest, useFriends } from "@/hooks/useFriends";
import { useLang } from "@/hooks/useLang";
import { isNotificationType, NOTIFICATIONS, type NotificationType, renderNotification } from "@/lib/notifications/catalog";
import type { NotificationItem } from "@/lib/notifications/types";
import { useTranslations } from "@/lib/i18n/utils";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import styles from "./NotificationsInbox.module.css";

type Tone = "accent" | "warning" | "info" | "success" | "danger";

const TONE_CLASS: Record<Tone, string> = {
  accent: styles.toneAccent,
  warning: styles.toneWarning,
  info: styles.toneInfo,
  success: styles.toneSuccess,
  danger: styles.toneDanger,
};

/** Icon and colour of a notification type (by family, with a few exceptions). */
function look(type: string): { Icon: LucideIcon; tone: Tone } {
  if (!isNotificationType(type)) return { Icon: Bell, tone: "accent" };
  switch (type) {
    case "budget.threshold":
      return { Icon: Target, tone: "danger" };
    case "summary.monthly":
      return { Icon: ChartColumn, tone: "success" };
    case "import.reminder":
      return { Icon: FileUp, tone: "success" };
    case "shared.settlement":
      return { Icon: HandCoins, tone: "accent" };
  }
  switch (NOTIFICATIONS[type as NotificationType].family) {
    case "subscriptions":
      return { Icon: Repeat, tone: "warning" };
    case "subcount":
      return { Icon: Receipt, tone: "accent" };
    case "friends":
      return { Icon: UserPlus, tone: "info" };
    case "joint":
      return { Icon: Landmark, tone: "info" };
    default:
      return { Icon: Bell, tone: "accent" };
  }
}

type Answer = "accepted" | "declined";

/** Accept / decline buttons, or what became of the request ("Accepted", "Declined", "Already answered"). */
function Response({ ready, pending, answer, onAnswer }: { ready: boolean; pending: boolean; answer: Answer | null; onAnswer: (answer: Answer) => void }) {
  const t = useTranslations(useLang());
  if (!ready) return null;
  if (answer || !pending) {
    const text = answer === "accepted" ? t("notifications.accepted") : answer === "declined" ? t("notifications.declined") : t("notifications.answered");
    return (
      <span className={cn(styles.answered, answer === "accepted" && styles.answeredOk)}>
        {answer === "accepted" && <Check aria-hidden />}
        {text}
      </span>
    );
  }
  return (
    <div className={styles.actions}>
      <button type="button" className={cn(styles.btn, styles.btnPrimary)} onClick={() => onAnswer("accepted")}>
        {t("notifications.accept")}
      </button>
      <button type="button" className={styles.btn} onClick={() => onAnswer("declined")}>
        {t("notifications.decline")}
      </button>
    </div>
  );
}

/** Friend request: still pending when the requester has an incoming request in my friends data. */
function FriendRequestResponse({ item, onAnswered }: { item: NotificationItem; onAnswered: () => void }) {
  const t = useTranslations(useLang());
  const { data, isSuccess } = useFriends();
  const respond = useRespondFriendRequest();
  const [answer, setAnswer] = useState<Answer | null>(null);
  const request = data?.incoming.find((friendship) => friendship.profile.user_id === item.actor_id);

  return (
    <Response
      ready={isSuccess}
      pending={!!request}
      answer={answer}
      onAnswer={(next) => {
        if (!request) return;
        setAnswer(next);
        respond.mutate(
          { id: request.id, accept: next === "accepted" },
          {
            onSuccess: () => {
              if (next === "accepted") toast.success(t("friends.accepted"));
              onAnswered();
            },
            onError: () => setAnswer(null),
          }
        );
      }}
    />
  );
}

/** Joint account invite: still pending when it is in my invites. */
function JointInviteResponse({ item, onAnswered }: { item: NotificationItem; onAnswered: () => void }) {
  const t = useTranslations(useLang());
  const { data, isSuccess } = useAccountInvites();
  const respond = useRespondAccountInvite();
  const [answer, setAnswer] = useState<Answer | null>(null);
  const accountId = typeof item.params.accountId === "string" ? item.params.accountId : null;
  const invite = accountId ? data?.find((candidate) => candidate.account_id === accountId) : undefined;

  return (
    <Response
      ready={isSuccess}
      pending={!!invite}
      answer={answer}
      onAnswer={(next) => {
        if (!invite) return;
        setAnswer(next);
        respond.mutate(
          { accountId: invite.account_id, accept: next === "accepted" },
          {
            onSuccess: () => {
              if (next === "accepted") toast.success(t("joint.accepted"));
              onAnswered();
            },
            onError: () => setAnswer(null),
          }
        );
      }}
    />
  );
}

/** One inbox entry: tap to read and open, swipe (or hover on desktop) for mark read/unread and delete. */
export const NotificationRow = memo(function NotificationRow({ item, timeLabel, onOpen, onToggleRead, onDelete, onAnswered }: {
  item: NotificationItem;
  timeLabel: string;
  onOpen: (item: NotificationItem) => void;
  onToggleRead: (item: NotificationItem) => void;
  onDelete: (item: NotificationItem) => void;
  /** The user answered a request from the row: it counts as read. */
  onAnswered: (item: NotificationItem) => void;
}) {
  const lang = useLang();
  const t = useTranslations(lang);
  const unread = item.read_at == null;
  const { Icon, tone } = look(item.type);
  const { title, bodyParts } = renderNotification(item, t, lang);

  const stop = (action: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    action();
  };

  return (
    <SwipeToReveal
      id={item.id}
      className="lp-swipe lp-swipe--2"
      desktopMinWidth={1024}
      actions={
        <>
          <button
            type="button"
            className="lp-action lp-action--edit"
            aria-label={t(unread ? "notifications.markRead" : "notifications.markUnread")}
            title={t(unread ? "notifications.markRead" : "notifications.markUnread")}
            onClick={stop(() => onToggleRead(item))}
          >
            {unread ? <MailOpen className="size-5" /> : <Mail className="size-5" />}
          </button>
          <button type="button" className="lp-action lp-action--danger" aria-label={t("notifications.delete")} title={t("notifications.delete")} onClick={stop(() => onDelete(item))}>
            <Trash2 className="size-5" />
          </button>
        </>
      }
    >
      <div
        role="button"
        tabIndex={0}
        className={cn("lp-row", styles.row, TONE_CLASS[tone], unread && styles.unread)}
        onClick={() => onOpen(item)}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget || (e.key !== "Enter" && e.key !== " ")) return;
          e.preventDefault();
          onOpen(item);
        }}
      >
        {item.actor ? (
          <span className={styles.avatar}>
            <ProfileAvatar name={item.actor.display_name} url={item.actor.avatar_url} size={38} />
            <span className={styles.avatarBadge} aria-hidden>
              <Icon />
            </span>
          </span>
        ) : (
          <span className={styles.tile} aria-hidden>
            <Icon />
          </span>
        )}
        <span className="lp-main">
          <span className={styles.title}>{title}</span>
          {bodyParts.length > 0 && (
            <span className={styles.body}>
              {bodyParts.map((part, index) => (part.amount ? <SensitiveAmount key={index}>{part.text}</SensitiveAmount> : <span key={index}>{part.text}</span>))}
            </span>
          )}
          {item.type === "friend.request_received" && <FriendRequestResponse item={item} onAnswered={() => onAnswered(item)} />}
          {item.type === "joint.invite_received" && <JointInviteResponse item={item} onAnswered={() => onAnswered(item)} />}
        </span>
        <span className={styles.end}>
          <span className={styles.time}>{timeLabel}</span>
          {unread && (
            <>
              <span className={styles.dot} aria-hidden />
              <span className="sr-only">{t("notifications.unreadDot")}</span>
            </>
          )}
        </span>
      </div>
    </SwipeToReveal>
  );
});
