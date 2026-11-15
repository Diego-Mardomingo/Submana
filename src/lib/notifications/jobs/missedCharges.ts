/** Cron job: charges that should have arrived (grace window over) and have no transaction. */
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPages } from "@/lib/apiHelpers";
import { toDateString } from "@/lib/date";
import { recentMissedCharges, type ReconcilableSubscription } from "@/lib/subscriptionReconciliation";
import { SUBSCRIPTION_SELECT } from "@/lib/subscriptionsServer";
import type { NotifyEvent } from "../core";
import { euros } from "../events/common";
import type { MadridClock } from "./time";

export type MissedChargeSubscription = ReconcilableSubscription & { id: string; user_id: string; service_name: string };

/** One per charge (the dedupe key makes reruns and the next days' runs add nothing). */
export const missedChargeDedupeKey = (subscriptionId: string, date: string) => `subscription.missed_charge:${subscriptionId}:${date}`;

/**
 * The missed charges to notify today. A charge only counts as missed once the subscription is being
 * tracked (from its first linked charge on) and the 3-day grace window is over; charges that went missed
 * more than a week ago are not notified (the first run after deploying would otherwise flood the inbox).
 */
export function missedChargeEvents(subscriptions: readonly MissedChargeSubscription[], today: Date): NotifyEvent[] {
  const events: NotifyEvent[] = [];
  for (const sub of subscriptions) {
    for (const missed of recentMissedCharges(sub, today)) {
      events.push({
        userId: sub.user_id,
        entityType: "subscription",
        entityId: sub.id,
        type: "subscription.missed_charge",
        params: { subscriptionId: sub.id, name: sub.service_name, date: missed.date, amount: euros(missed.expected) },
        dedupeKey: missedChargeDedupeKey(sub.id, missed.date),
      });
    }
  }
  return events;
}

/** Subscriptions with at least one linked charge (the others have nothing to check against). */
export async function loadMissedChargeEvents(admin: SupabaseClient, clock: MadridClock): Promise<NotifyEvent[]> {
  // Ended ones too while their last charge can still turn missed.
  const endedSince = toDateString(new Date(clock.year, clock.month - 1, clock.day - 14, 12));
  const select: string = SUBSCRIPTION_SELECT.replace("charges:transactions!transactions_subscription_id_fkey(", "charges:transactions!transactions_subscription_id_fkey!inner(");
  const subscriptions = await fetchAllPages<MissedChargeSubscription>((from, to) =>
    admin
      .from("subscriptions")
      .select(select)
      .or(`end_date.is.null,end_date.gte.${endedSince}`)
      .order("id")
      .range(from, to)
      .returns<MissedChargeSubscription[]>()
  );
  return missedChargeEvents(subscriptions, clock.today);
}
