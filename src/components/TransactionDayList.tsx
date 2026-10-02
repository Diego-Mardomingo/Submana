"use client";

import { memo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { ConfirmDeleteSheet } from "@/components/ConfirmSheet";
import { SensitiveAmount } from "@/components/SensitiveAmount";
import { SwipeToReveal, SwipeToRevealGroup } from "@/components/SwipeToReveal";
import { TransactionSheet } from "@/components/TransactionSheet";
import { useCategoryLookup } from "@/hooks/useCategories";
import { useLang } from "@/hooks/useLang";
import { useDeleteTransaction, type Transaction } from "@/hooks/useTransactions";
import { appNow, calendarDayInAppTimeZone, parseDateString, toDateString } from "@/lib/date";
import { formatCurrency, localeOf } from "@/lib/format";
import { useTranslations } from "@/lib/i18n/utils";

export const TrendIcon = ({ income, size = 18 }: { income: boolean; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
    <polyline points={income ? "23 6 13.5 15.5 8.5 10.5 1 18" : "23 18 13.5 8.5 8.5 13.5 1 6"} />
    <polyline points={income ? "17 6 23 6 23 12" : "17 18 23 18 23 12"} />
  </svg>
);

/** "+1.234,56 €" / "-12,00 €" */
export const signed = (n: number) => `${n >= 0 ? "+" : "-"}${formatCurrency(Math.abs(n))}`;

const TransactionRow = memo(function TransactionRow(props: {
  tx: Transaction;
  emoji?: string;
  fallbackLabel: string;
  onOpen: (tx: Transaction) => void;
  hideAccount?: boolean;
  /** Excluded from metrics (e.g. transfers between own accounts): shown muted. */
  excluded?: boolean;
}) {
  const { tx, emoji, fallbackLabel, onOpen, hideAccount, excluded } = props;
  const income = tx.type === "income";
  const category = tx.subcategory?.name ?? tx.category?.name;
  const account = hideAccount ? null : tx.account;
  return (
    <button type="button" className="lp-row" onClick={() => onOpen(tx)}>
      <span className={`lp-icon ${!emoji && income && !excluded ? "lp-icon--income" : ""}`} aria-hidden>
        {emoji ?? <TrendIcon income={income} />}
      </span>
      <span className="lp-main">
        <span className="lp-title">
          <span>{tx.description || tx.category?.name || fallbackLabel}</span>
        </span>
        {(account || category) && (
          <span className="lp-meta">
            {account && (
              <>
                <span className="lp-dot" style={{ backgroundColor: account.color || "var(--gris-claro)" }} />
                <span className={category ? undefined : "lp-truncate"}>{account.name}</span>
              </>
            )}
            {account && category && <span className="lp-meta-sep">·</span>}
            {category && <span className="lp-truncate">{category}</span>}
          </span>
        )}
      </span>
      <span className={`lp-amount ${excluded ? "is-muted" : income ? "is-income" : "is-expense"}`}>
        {income ? "+" : "-"}
        <SensitiveAmount>{formatCurrency(Number(tx.amount))}</SensitiveAmount>
      </span>
    </button>
  );
});

/**
 * Transactions grouped by day (newest first) with the day's net amount. Tapping a row opens the
 * edit sheet; swiping (or hovering on desktop) reveals edit / delete.
 */
export function TransactionDayList({ transactions, countedIds, hideAccount }: {
  transactions: Transaction[];
  /** Transactions that count for metrics; the rest are shown muted and left out of day totals. */
  countedIds: Set<string>;
  hideAccount?: boolean;
}) {
  const lang = useLang();
  const es = lang === "es";
  const t = useTranslations(lang);
  const categoryLookup = useCategoryLookup();
  const deleteTx = useDeleteTransaction();
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [toDelete, setToDelete] = useState<Transaction | null>(null);

  const byDay = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    const day = calendarDayInAppTimeZone(tx.date);
    byDay.set(day, [...(byDay.get(day) ?? []), tx]);
  }
  const days = [...byDay.keys()].sort().reverse();
  const now = appNow();
  const today = toDateString(now);
  const yesterday = toDateString(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const dayLabel = (day: string) => {
    const date = parseDateString(day).toLocaleDateString(localeOf(lang), { weekday: "long", day: "numeric", month: "short" });
    if (day === today) return { title: es ? "Hoy" : "Today", detail: date };
    if (day === yesterday) return { title: es ? "Ayer" : "Yesterday", detail: date };
    return { title: date };
  };
  const dayNet = (txs: Transaction[]) =>
    txs.reduce((sum, tx) => (countedIds.has(tx.id) ? sum + (tx.type === "income" ? 1 : -1) * Number(tx.amount) : sum), 0);
  const emoji = (tx: Transaction) => {
    const lookup = (id?: string | null) => (id ? categoryLookup.emoji.get(id) : undefined);
    return lookup(tx.subcategory_id) ?? lookup(tx.category_id) ?? lookup(categoryLookup.parent.get(tx.subcategory_id ?? ""));
  };

  return (
    <>
      <div className="lp-sections">
        {days.map((day) => {
          const txs = byDay.get(day)!;
          const net = dayNet(txs);
          const label = dayLabel(day);
          return (
            <section className="lp-section" key={day}>
              <div className="lp-section-head">
                <span className="lp-section-title">
                  {label.title}
                  {label.detail && <small>{label.detail}</small>}
                </span>
                <span className={`lp-section-aside ${net > 0 ? "is-income" : ""}`}>
                  <SensitiveAmount>{signed(net)}</SensitiveAmount>
                </span>
              </div>
              <SwipeToRevealGroup className="lp-card lp-group">
                {txs.map((tx) => (
                  <SwipeToReveal
                    key={tx.id}
                    id={tx.id}
                    className="lp-swipe"
                    desktopMinWidth={1024}
                    actions={
                      <>
                        <button type="button" onClick={() => setEditing(tx)} className="lp-action lp-action--edit" aria-label={t("common.edit")}>
                          <Pencil className="size-5" />
                        </button>
                        <button type="button" onClick={() => setToDelete(tx)} className="lp-action lp-action--danger" aria-label={t("common.delete")}>
                          <Trash2 className="size-5" />
                        </button>
                      </>
                    }
                  >
                    <TransactionRow
                      tx={tx}
                      emoji={emoji(tx)}
                      fallbackLabel={t(tx.type === "income" ? "transactions.income" : "transactions.expense")}
                      onOpen={setEditing}
                      hideAccount={hideAccount}
                      excluded={!countedIds.has(tx.id)}
                    />
                  </SwipeToReveal>
                ))}
              </SwipeToRevealGroup>
            </section>
          );
        })}
      </div>

      <TransactionSheet open={!!editing} onOpenChange={(open) => !open && setEditing(null)} transaction={editing} />

      <ConfirmDeleteSheet
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={es ? "¿Eliminar esta transacción?" : "Delete this transaction?"}
        description={
          toDelete && (
            <>
              <strong>
                {toDelete.description || t(toDelete.type === "income" ? "transactions.income" : "transactions.expense")} ·{" "}
                <SensitiveAmount>{formatCurrency(Number(toDelete.amount))}</SensitiveAmount>
              </strong>
              <br />
              {t("transactions.deleteConfirm")}
            </>
          )
        }
        confirmLabel={es ? "Sí, eliminar" : "Yes, delete"}
        pending={deleteTx.isPending}
        onConfirm={async () => {
          if (!toDelete) return;
          await deleteTx.mutateAsync(toDelete.id).catch(() => undefined);
          setToDelete(null);
        }}
      />
    </>
  );
}
