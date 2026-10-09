/** Pure part of the web push: what the service worker receives. No server APIs (tested in isolation). */
import type { Lang } from "@/lib/i18n/ui";
import { getTranslations } from "@/lib/i18n/utils";
import { safeInternalPath } from "@/lib/navigation";
import { renderNotification } from "./catalog";
import type { NotificationRow } from "./types";

/** JSON sent to the device; `sw.ts` shows it as is (title, body, tag) and opens `url` on click. */
export interface PushPayload {
  title: string;
  body: string;
  /** Internal path to open on click. */
  url: string;
  /** Pushes sharing a tag replace each other on the device instead of stacking. */
  tag: string;
  id: string;
}

/** Seconds a push service keeps an undelivered message (the device was off): older news is not worth showing. */
export const PUSH_TTL_SECONDS = 24 * 60 * 60;

/**
 * Subcount rows share `group:{id}` (the last expense replaces the previous one), aggregated rows (joint
 * movements) share `{type}:{aggregate_key}`, and the rest get their own tag (the row id).
 */
export function pushTag(row: Pick<NotificationRow, "id" | "type" | "params" | "aggregate_key">): string {
  const groupId = row.type.startsWith("shared.") ? (row.params as { groupId?: unknown } | null)?.groupId : null;
  if (typeof groupId === "string" && groupId) return `group:${groupId}`;
  if (row.aggregate_key) return `${row.type}:${row.aggregate_key}`;
  return row.id;
}

/** Title and body in the recipient's language; with `hideAmounts` the body has no amounts at all. */
export function buildPushPayload(row: NotificationRow, lang: Lang, opts: { hideAmounts?: boolean } = {}): PushPayload {
  const { title, body } = renderNotification(row, getTranslations(lang), lang, { hideAmounts: opts.hideAmounts });
  return { title, body, url: safeInternalPath(row.url, "/notifications"), tag: pushTag(row), id: row.id };
}

/** The endpoint is gone for good (unsubscribed or expired): its subscription must be deleted. */
export const isGonePushStatus = (statusCode: unknown) => statusCode === 404 || statusCode === 410;
