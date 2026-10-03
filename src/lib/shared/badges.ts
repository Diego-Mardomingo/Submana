import type { UIKey } from "@/lib/i18n/ui";
import { formatCurrency } from "@/lib/format";
import type { TransactionSharedExpense } from "./types";

interface BadgeTx {
  amount?: number | string;
  metric_amount?: number | string | null;
  source?: string;
  shared_expense?: TransactionSharedExpense | null;
}

export interface SharedBadge {
  kind: "share" | "paid" | "settlement" | "warn";
  key: UIKey;
  values: Record<string, string>;
}

/**
 * Badges of a transaction row tied to a shared expense: my share when I paid, who paid when a
 * friend did, settlements and a warning when the bank amount no longer matches the shared total.
 */
export function sharedBadges(tx: BadgeTx): SharedBadge[] {
  const shared = tx.shared_expense;
  if (!shared) return [];
  if (shared.kind === "settlement") return [{ kind: "settlement", key: "shared.settlement", values: {} }];
  if (tx.source === "shared") {
    return [{ kind: "paid", key: "shared.paidBy", values: { handle: shared.paid_by_handle ?? "?" } }];
  }
  const badges: SharedBadge[] = [
    { kind: "share", key: "shared.yourShare", values: { amount: formatCurrency(Number(tx.metric_amount ?? tx.amount)) } },
  ];
  if (Math.abs(Number(tx.amount) - Number(shared.total_amount)) > 0.005) {
    badges.push({ kind: "warn", key: "shared.mismatch.short", values: {} });
  }
  return badges;
}
