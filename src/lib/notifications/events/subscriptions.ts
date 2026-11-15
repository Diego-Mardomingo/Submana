/**
 * Notifications of subscription reconciliation (issue #108): what automatic matching found in new
 * movements (price change, charge of an ended subscription, movement to confirm). Pure: the caller
 * passes the events to `notifyAfter`.
 */
import type { ReconcileSummary } from "@/lib/subscriptionAutoMatch";
import type { NotifyEvent } from "../core";
import { euros } from "./common";

/**
 * Events for one user. `selfInitiated`: the user is in front of the app (a toast already told them),
 * so the rows are stored as history only. Otherwise (bank sync, statement import) they ring.
 */
export function reconcileEvents(userId: string, summary: ReconcileSummary, opts: { selfInitiated?: boolean } = {}): NotifyEvent[] {
  // No actor: the row would show the user's own avatar. selfInitiated alone keeps it as read history.
  const base = { userId, entityType: "subscription", ...(opts.selfInitiated && { selfInitiated: true }) };
  const events: NotifyEvent[] = [];
  for (const change of summary.priceChanges) {
    events.push({
      ...base,
      entityId: change.subscriptionId,
      type: "subscription.price_change",
      params: { subscriptionId: change.subscriptionId, name: change.serviceName, chargeDate: change.chargeDate, charged: euros(change.charged), saved: euros(change.saved) },
      dedupeKey: priceChangeDedupeKey(change.subscriptionId, change.chargeDate),
    });
  }
  for (const found of summary.unexpected) {
    if (!found.accountId) continue;
    events.push({
      ...base,
      entityId: found.subscriptionId,
      type: "subscription.unexpected_charge",
      params: { subscriptionId: found.subscriptionId, name: found.serviceName, accountId: found.accountId, transactionId: found.transactionId, date: found.txDate, amount: euros(found.amount), endDate: found.endDate },
      dedupeKey: `subscription.unexpected_charge:${found.transactionId}`,
    });
  }
  for (const review of summary.reviews) {
    if (!review.accountId) continue;
    events.push({
      ...base,
      entityId: review.subscriptionId,
      type: "subscription.match_review",
      params: { subscriptionId: review.subscriptionId, name: review.serviceName, accountId: review.accountId, transactionId: review.transactionId, date: review.txDate, amount: euros(review.amount), description: review.description },
      dedupeKey: `subscription.match_review:${review.transactionId}:${review.subscriptionId}`,
    });
  }
  return events;
}

/** One price-change notification per charge (accepting or ignoring the price marks it read). */
export const priceChangeDedupeKey = (subscriptionId: string, chargeDate: string) => `subscription.price_change:${subscriptionId}:${chargeDate}`;
