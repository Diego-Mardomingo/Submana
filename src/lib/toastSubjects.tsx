import { initialsAvatarDataUri } from "@/lib/initialsAvatar";
import type { ToastSubject } from "@/lib/toast";

/**
 * The `subject` of the toasts shown when an item is created, saved or deleted: what it is, with its
 * emoji or logo and its amount (see `ToastSubject`).
 */

const Logo = ({ src }: { src: string }) => (
  // eslint-disable-next-line @next/next/no-img-element -- remote service logos
  <img src={src} alt="" />
);

/** A transaction: category emoji, description (or "Expense"/"Income") and the signed amount. */
export function transactionSubject(
  tx: { type: string; amount: number | string; description?: string | null },
  emoji: string | undefined,
  fallbackLabel: string
): ToastSubject {
  return {
    icon: emoji,
    label: tx.description?.trim() || fallbackLabel,
    amount: (tx.type === "income" ? 1 : -1) * Number(tx.amount),
    signed: true,
  };
}

/** A subscription: logo, name and price. */
export function subscriptionSubject(sub: { service_name: string; icon?: string | null; cost: number | string }): ToastSubject {
  return {
    icon: <Logo src={sub.icon || initialsAvatarDataUri(sub.service_name)} />,
    label: sub.service_name,
    amount: Number(sub.cost),
  };
}

/** A Subcount expense: the subscription's logo when a shared subscription created it, title and total. */
export function sharedExpenseSubject(expense: { title: string; total_amount: number | string; subscription_icon?: string | null }): ToastSubject {
  return {
    icon: expense.subscription_icon ? <Logo src={expense.subscription_icon} /> : undefined,
    label: expense.title,
    amount: Number(expense.total_amount),
  };
}

/** A budget: its first category's emoji, its name and its limit. */
export function budgetSubject(name: string, emoji: string | undefined, limit: number | string): ToastSubject {
  return { icon: emoji, label: name, amount: Number(limit) };
}
