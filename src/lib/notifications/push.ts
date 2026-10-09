/**
 * Web push sender (server only, Node runtime). `notify()` passes the freshly generated rows whose type
 * has `push: true` and that are not read yet. Never throws: a failed push must not break anything.
 */
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildPushPayload, isGonePushStatus, PUSH_TTL_SECONDS } from "./pushPayload";
import { loadNotificationSettings } from "./settings";
import type { NotificationRow } from "./types";

export { buildPushPayload, pushTag, type PushPayload } from "./pushPayload";

interface VapidConfig {
  subject: string;
  publicKey: string;
  privateKey: string;
}

function vapidConfig(): VapidConfig | null {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  return publicKey && privateKey && subject ? { subject, publicKey, privateKey } : null;
}

/** Whether the VAPID keys are set (without them push is a no-op). */
export const isPushConfigured = () => vapidConfig() !== null;

let warned = false;

interface StoredSubscription {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export async function sendPush(rows: NotificationRow[]): Promise<void> {
  try {
    if (rows.length === 0) return;
    const vapid = vapidConfig();
    if (!vapid) {
      if (!warned) {
        warned = true;
        console.warn("[push] VAPID keys are not set (NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT): push is disabled");
      }
      return;
    }

    const admin = createAdminClient();
    const userIds = [...new Set(rows.map((row) => row.user_id))];
    const [settings, { data, error }] = await Promise.all([
      loadNotificationSettings(userIds, admin),
      admin.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth").in("user_id", userIds),
    ]);
    if (error) throw error;

    const subscriptionsByUser = new Map<string, StoredSubscription[]>();
    for (const subscription of (data ?? []) as StoredSubscription[]) {
      subscriptionsByUser.set(subscription.user_id, [...(subscriptionsByUser.get(subscription.user_id) ?? []), subscription]);
    }

    const gone = new Set<string>();
    const delivered = new Set<string>();
    const sends: Promise<void>[] = [];
    for (const row of rows) {
      const subscriptions = subscriptionsByUser.get(row.user_id);
      if (!subscriptions?.length) continue;
      const userSettings = settings.get(row.user_id);
      const payload = JSON.stringify(buildPushPayload(row, userSettings?.lang ?? "es", { hideAmounts: userSettings?.push_hide_amounts }));
      for (const subscription of subscriptions) {
        sends.push(
          webpush
            .sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, payload, {
              TTL: PUSH_TTL_SECONDS,
              timeout: 10_000,
              vapidDetails: vapid,
            })
            .then(() => {
              delivered.add(subscription.id);
            })
            .catch((sendError: unknown) => {
              const statusCode = (sendError as { statusCode?: number } | null)?.statusCode;
              if (isGonePushStatus(statusCode)) gone.add(subscription.id);
              else console.error("[push] send failed", statusCode ?? sendError);
            })
        );
      }
    }
    await Promise.all(sends);

    if (gone.size > 0) {
      const { error: deleteError } = await admin.from("push_subscriptions").delete().in("id", [...gone]);
      if (deleteError) console.error("[push] cleanup", deleteError);
    }
    if (delivered.size > 0) {
      const { error: updateError } = await admin
        .from("push_subscriptions")
        .update({ last_success_at: new Date().toISOString() })
        .in("id", [...delivered]);
      if (updateError) console.error("[push] last_success_at", updateError);
    }
  } catch (error) {
    console.error("[push]", error);
  }
}
