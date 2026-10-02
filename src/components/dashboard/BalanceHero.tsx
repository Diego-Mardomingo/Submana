"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, CreditCard } from "lucide-react";
import { Bones } from "@/components/Bones";
import { MonthRangePicker } from "@/components/dashboard/MonthRangePicker";
import { SensitiveAmount } from "@/components/SensitiveAmount";
import { useAccounts, type Account } from "@/hooks/useAccounts";
import { useLang } from "@/hooks/useLang";
import { useTransactionsRange, type DateRange } from "@/hooks/useTransactions";
import { appNow, monthKey } from "@/lib/date";
import { formatCurrency, monthKeyLabel } from "@/lib/format";
import { netBalanceChange, runningTotals } from "@/lib/metricsFilters";
import { cn } from "@/lib/utils";
import { BalanceLine, signClass, signedMoney } from "./shared";

const accountColor = (account: Account) => account.color || "var(--accent)";

/**
 * Total balance with every account as a selector: the chart below shows the month-end balance
 * history of the selection (all accounts by default), rebuilt backwards from the current balance.
 */
export default function BalanceHero() {
  const lang = useLang();
  const es = lang === "es";
  const { data: accounts = [], isLoading: accountsLoading } = useAccounts();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = accounts.find((acc) => acc.id === selectedId) ?? null;

  // Every selection shares the months of the whole history unless a custom range is picked.
  const all = useTransactionsRange();
  const [customRange, setCustomRange] = useState<DateRange | null>(null);
  const range = customRange ?? all.availableRange ?? undefined;
  const series = useTransactionsRange(selected?.id, range);

  const total = accounts.reduce((sum, acc) => sum + Number(acc.balance ?? 0), 0);
  const positiveTotal = accounts.reduce((sum, acc) => sum + Math.max(0, Number(acc.balance ?? 0)), 0);
  const balance = selected ? Number(selected.balance ?? 0) : total;

  const netOf = (key: string) => netBalanceChange(series.byMonth.get(key) ?? []);
  const firstKey = series.keys[0] ?? "";
  const startBalance = balance - series.allKeys.filter((key) => key >= firstKey).reduce((sum, key) => sum + netOf(key), 0);
  const points = runningTotals(series.keys.map(netOf), startBalance);
  const now = appNow();
  const thisMonth = netOf(monthKey(now.getFullYear(), now.getMonth() + 1));

  if (accountsLoading) return <Bones name="dashboard-balance" loading fallback={<div className="lp-card skeleton dash-hero-skeleton" aria-hidden />} />;

  if (accounts.length === 0) {
    return (
      <section className="lp-card lp-empty">
        <div className="lp-empty-icon">
          <CreditCard size={24} strokeWidth={2.5} />
        </div>
        <p className="lp-empty-title">{es ? "Aún no tienes cuentas" : "No accounts yet"}</p>
        <p className="lp-empty-text">{es ? "Añade tus cuentas para ver aquí tu saldo y su evolución" : "Add your accounts to see your balance and its history here"}</p>
        <Link href="/accounts" className="lp-chip">
          {es ? "Ir a cuentas" : "Go to accounts"}
        </Link>
      </section>
    );
  }

  const tile = (id: string | null, name: string, amount: number, dot: React.ReactNode) => (
    <button
      key={id ?? "total"}
      type="button"
      className="dash-account"
      aria-pressed={selectedId === id}
      onClick={() => setSelectedId(id)}
    >
      <span className="dash-account-name">
        {dot}
        <span>{name}</span>
      </span>
      <span className={cn("dash-account-value", amount < 0 && "is-negative")}>
        <SensitiveAmount>{formatCurrency(amount)}</SensitiveAmount>
      </span>
    </button>
  );

  return (
    <Bones name="dashboard-balance" loading={false}>
      <section className="lp-card dash-hero" aria-label={es ? "Saldo" : "Balance"}>
        <div className="dash-hero-summary">
          <div className="lp-summary-top">
            <span className="lp-label">{selected ? selected.name : es ? "Saldo total" : "Total balance"}</span>
            {selected ? (
              <Link href={`/account/${selected.id}`} className="dash-see-all">
                {es ? "Ver cuenta" : "Open account"}
                <ChevronRight className="size-3.5" strokeWidth={2.5} aria-hidden />
              </Link>
            ) : (
              <span className="lp-count">
                {accounts.length} {es ? (accounts.length === 1 ? "cuenta" : "cuentas") : accounts.length === 1 ? "account" : "accounts"}
              </span>
            )}
          </div>
          <div className="dash-hero-value-row">
            <span className={cn("dash-hero-value", balance < 0 && "is-negative")}>
              <SensitiveAmount applyGradient={balance >= 0}>{formatCurrency(balance)}</SensitiveAmount>
            </span>
            {!series.isLoading && (
              <span className={cn("dash-delta", signClass(thisMonth))}>
                {signedMoney(thisMonth)} {es ? "este mes" : "this month"}
              </span>
            )}
          </div>
          {positiveTotal > 0 && (
            <div className="lp-meter lp-meter--segmented dash-hero-meter" aria-hidden>
              {accounts
                .filter((acc) => Number(acc.balance ?? 0) > 0)
                .map((acc) => (
                  <span
                    key={acc.id}
                    className={cn(selected && selected.id !== acc.id && "is-dim")}
                    style={{ width: `${(Number(acc.balance) / positiveTotal) * 100}%`, background: accountColor(acc) }}
                  />
                ))}
            </div>
          )}
          <div className="dash-accounts" role="group" aria-label={es ? "Cuentas" : "Accounts"}>
            {tile(null, "Total", total, <span className="dash-account-dot dash-account-dot--all" aria-hidden />)}
            {accounts.map((acc) =>
              tile(
                acc.id,
                acc.name,
                Number(acc.balance ?? 0),
                acc.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element -- remote logos from arbitrary hosts
                  <img src={acc.icon} alt="" className="dash-account-logo" />
                ) : (
                  <span className="dash-account-dot" style={{ background: accountColor(acc) }} aria-hidden />
                )
              )
            )}
          </div>
        </div>

        <div className="dash-hero-chart">
          <div className="dash-card-head">
            <h2 className="lp-section-title">{es ? "Evolución del saldo" : "Balance history"}</h2>
            {!all.isLoading && (
              <MonthRangePicker
                shown={range ?? null}
                available={all.availableRange}
                isCustom={!!customRange}
                onChange={setCustomRange}
                monthCount={series.keys.length}
              />
            )}
          </div>
          <div className="dash-chart dash-chart--hero">
            {series.isLoading ? (
              <div className="skeleton dash-chart-skeleton" />
            ) : points.length === 0 ? (
              <p className="dash-empty">{es ? "Sin movimientos todavía" : "No transactions yet"}</p>
            ) : (
              <BalanceLine labels={series.keys.map((key) => monthKeyLabel(key, lang))} points={points} color={selected?.color} />
            )}
          </div>
        </div>
      </section>
    </Bones>
  );
}
