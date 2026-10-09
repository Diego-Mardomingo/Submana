/** Cron job: renewal reminders and end-of-subscription notices. */
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPages } from "@/lib/apiHelpers";
import { ENDING_NOTICE_DAYS, endingNotice, renewalReminders, type ReminderSchedule } from "@/lib/subscriptions";
import type { NotifyEvent } from "../core";
import type { MadridClock } from "./time";

export interface SubscriptionRow extends ReminderSchedule {
  id: string;
  user_id: string;
  service_name: string;
  cost: number | string;
}

/**
 * The notifications due today. Renewals: one per reminder offset of the subscription whose charge is that
 * many days away. Ending: the end date is 3 days away (independent of the reminder offsets). When the end
 * date is itself the last charge, the ending notice already says so and replaces the 3-day renewal.
 */
export function renewalEvents(subscriptions: readonly SubscriptionRow[], today: Date): NotifyEvent[] {
  const events: NotifyEvent[] = [];
  for (const sub of subscriptions) {
    const base = { userId: sub.user_id, entityType: "subscription", entityId: sub.id };
    const name = sub.service_name;
    const ending = endingNotice(sub, today);

    for (const { offset, chargeDate } of renewalReminders(sub, today)) {
      if (ending?.lastCharge && chargeDate === ending.endDate && offset === ENDING_NOTICE_DAYS) continue;
      events.push({
        ...base,
        type: "subscription.renewal",
        params: { subscriptionId: sub.id, name, amount: Number(sub.cost) || 0, date: chargeDate, daysBefore: offset },
        dedupeKey: `subscription.renewal:${sub.id}:${chargeDate}:${offset}`,
      });
    }
    if (ending) {
      events.push({
        ...base,
        type: "subscription.ending",
        params: { subscriptionId: sub.id, name, date: ending.endDate, lastCharge: ending.lastCharge },
        dedupeKey: `subscription.ending:${sub.id}:${ending.endDate}`,
      });
    }
  }
  return events;
}

/** Loads the subscriptions that have not ended yet (one query) and returns today's events. */
export async function loadRenewalEvents(admin: SupabaseClient, clock: MadridClock): Promise<NotifyEvent[]> {
  const subscriptions = await fetchAllPages<SubscriptionRow>((from, to) =>
    admin
      .from("subscriptions")
      .select("id, user_id, service_name, cost, start_date, end_date, frequency, frequency_value, reminder_offsets")
      .or(`end_date.is.null,end_date.gte.${clock.date}`)
      .order("id")
      .range(from, to)
  );
  return renewalEvents(subscriptions, clock.today);
}
