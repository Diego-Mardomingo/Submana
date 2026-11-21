import type { Lang } from "@/lib/i18n/ui";
import type { ReviewMode } from "@/lib/review/classify";
import type { NotificationParams, NotificationType, RenewalOffset } from "./catalog";

/** A row of `public.notifications` as the server reads it (type and params are what `notify()` wrote). */
export interface NotificationRow<T extends NotificationType = NotificationType> {
  id: string;
  user_id: string;
  type: T;
  actor_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  params: NotificationParams[T];
  url: string | null;
  dedupe_key: string | null;
  aggregate_key: string | null;
  created_at: string;
  read_at: string | null;
}

export const NOTIFICATION_COLUMNS = "id, user_id, type, actor_id, entity_type, entity_id, params, url, dedupe_key, aggregate_key, created_at, read_at";

export interface NotificationActor {
  handle: string;
  display_name: string;
  avatar_url: string | null;
}

/** What `GET /api/notifications` returns for each notification (the actor comes from the profiles the user can see). */
export interface NotificationItem {
  id: string;
  type: NotificationType;
  actor_id: string | null;
  actor: NotificationActor | null;
  entity_type: string | null;
  entity_id: string | null;
  params: Record<string, unknown>;
  url: string | null;
  created_at: string;
  read_at: string | null;
}

export interface NotificationsPage {
  items: NotificationItem[];
  /** Pass as `before` to get the next page; null when there are no more. */
  nextBefore: string | null;
}

export type NotificationFilter = "unread" | "all";

export interface NotificationCounts {
  /** Notifications with `read_at` null (the dot in the inbox). */
  unread: number;
  /** Unread ones created after the user last opened the inbox (what the bell rings for). */
  unseen: number;
}

/** `notification_settings` (the API returns these defaults when the user has no row yet). */
export interface NotificationSettings {
  lang: Lang;
  /** Types the user turned off (stored by type id; see NOTIFICATION_TOGGLES). */
  disabled_types: NotificationType[];
  /** Renewal reminders given to new subscriptions, sorted ascending. */
  default_renewal_offsets: RenewalOffset[];
  /** Day of the month (1-28) the monthly summary arrives. */
  summary_day: number;
  push_hide_amounts: boolean;
  last_seen_at: string | null;
  /** What the review deck shows: only what the app isn't sure about, or every new movement. */
  review_mode: ReviewMode;
  /** ISO weekday (1 = Monday) of the weekly "movements to review" notification. */
  review_day: number;
  /** Pending movements needed for that notification (see REVIEW_MIN_OPTIONS). */
  review_min: number;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  lang: "es",
  disabled_types: [],
  default_renewal_offsets: [1],
  summary_day: 4,
  push_hide_amounts: false,
  last_seen_at: null,
  review_mode: "doubt",
  review_day: 1,
  review_min: 1,
};

/** How many pending movements the weekly review notification can wait for. */
export const REVIEW_MIN_OPTIONS = [1, 3, 5, 10] as const;

export const SETTINGS_COLUMNS = "lang, disabled_types, default_renewal_offsets, summary_day, push_hide_amounts, last_seen_at, review_mode, review_day, review_min";

export type MuteTargetType = "group" | "account";

export interface NotificationMute {
  target_type: MuteTargetType;
  target_id: string;
  created_at: string;
}
