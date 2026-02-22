"use client";

import Link from "next/link";
import { useState } from "react";
import { useDeleteAccount } from "@/hooks/useAccountMutations";
import { useTransactions } from "@/hooks/useTransactions";
import { useLang } from "@/hooks/useLang";
import { useTranslations } from "@/lib/i18n/utils";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";

interface Account {
  id: string;
  name: string;
  balance: number;
  icon?: string;
  color?: string;
  is_default?: boolean;
}

interface TransactionItem {
  id: string;
  date: string;
  amount: number;
  type: string;
  description?: string;
  category?: { name: string };
}

export default function AccountDetail({ account }: { account: Account }) {
  const lang = useLang();
  const t = useTranslations(lang);
  const router = useRouter();
  const [showDelete, setShowDelete] = useState(false);
  const deleteAccount = useDeleteAccount();

  const { data: transactions = [], isLoading: txLoading } = useTransactions(
    undefined,
    undefined,
    account.id
  );

  const formatCurrency = (n: number) => {
    const formatted = new Intl.NumberFormat("es-ES", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      useGrouping: true,
    }).format(n);
    return `${formatted} €`;
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const day = d.getDate().toString().padStart(2, "0");
    const month = (d.getMonth() + 1).toString().padStart(2, "0");
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const formatMonthYear = (dateStr: string) => {
    const d = new Date(dateStr);
    const months = lang === "es"
      ? ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
      : ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return `${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  const formatDayMonth = (dateStr: string) => {
    const d = new Date(dateStr);
    const day = d.getDate();
    const months = lang === "es"
      ? ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
      : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${day} ${months[d.getMonth()]}`;
  };

  const groupTransactionsByMonthAndDay = (txs: TransactionItem[]) => {
    const sorted = [...txs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const byMonth: Record<string, Record<string, TransactionItem[]>> = {};

    for (const tx of sorted) {
      const d = new Date(tx.date);
      const monthKey = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}`;
      const dayKey = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;

      if (!byMonth[monthKey]) byMonth[monthKey] = {};
      if (!byMonth[monthKey][dayKey]) byMonth[monthKey][dayKey] = [];
      byMonth[monthKey][dayKey].push(tx);
    }

    return byMonth;
  };

  const handleDelete = async () => {
    await deleteAccount.mutateAsync(account.id);
    router.push("/accounts");
  };

  const groupedTransactions = groupTransactionsByMonthAndDay(transactions as TransactionItem[]);

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const thisMonthTransactions = (transactions as TransactionItem[]).filter((tx) => {
    const d = new Date(tx.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const thisMonthIncome = thisMonthTransactions.filter((tx) => tx.type === "income");
  const thisMonthExpense = thisMonthTransactions.filter((tx) => tx.type === "expense");

  const totalIncome = (transactions as TransactionItem[])
    .filter((tx) => tx.type === "income")
    .reduce((sum, tx) => sum + Number(tx.amount), 0);

  const totalExpense = (transactions as TransactionItem[])
    .filter((tx) => tx.type === "expense")
    .reduce((sum, tx) => sum + Number(tx.amount), 0);

  return (
    <>
      <div className="account-detail">
        <div className="account-detail-header">
          <div className="account-detail-icon">
            {account.icon ? (
              <img src={account.icon} alt={account.name} />
            ) : (
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--info)"
                strokeWidth="1.5"
              >
                <rect x="1" y="4" width="22" height="16" rx="2" />
                <line x1="1" y1="10" x2="23" y2="10" />
              </svg>
            )}
          </div>
          <h1 className="account-detail-name">{account.name}</h1>
          <div className="account-detail-balance">
            {formatCurrency(Number(account.balance))}
          </div>
          {account.is_default && (
            <span className="account-badge-default">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              {lang === "es" ? "Principal" : "Default"}
            </span>
          )}
        </div>

        <div className="account-detail-stats">
          <div className="account-stat-card">
            <span className="account-stat-label">{lang === "es" ? "Ingresos Totales" : "Total Income"}</span>
            <span className="account-stat-value income">{formatCurrency(totalIncome)}</span>
          </div>
          <div className="account-stat-card">
            <span className="account-stat-label">{lang === "es" ? "Gastos Totales" : "Total Expenses"}</span>
            <span className="account-stat-value expense">{formatCurrency(totalExpense)}</span>
          </div>
          <div className="account-stat-card">
            <span className="account-stat-label">{lang === "es" ? "Transacciones" : "Transactions"}</span>
            <span className="account-stat-sublabel">{lang === "es" ? "Este Mes" : "This Month"}</span>
            <div className="account-stat-row">
              <span className="account-stat-value">{thisMonthTransactions.length}</span>
              <span className="account-stat-separator">|</span>
              <span className="account-stat-inline income">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="17 11 12 6 7 11" />
                </svg>
                {thisMonthIncome.length}
              </span>
              <span className="account-stat-inline expense">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="7 13 12 18 17 13" />
                </svg>
                {thisMonthExpense.length}
              </span>
            </div>
          </div>
        </div>

        <div className="account-detail-actions">
          <Link href={`/account/${account.id}/edit`} className="btn-edit">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            {t("common.edit")}
          </Link>
          <Button
            variant="destructive"
            onClick={() => setShowDelete(true)}
            className="btn-delete"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
            {t("common.delete")}
          </Button>
        </div>

        <div className="account-transactions-section">
          <h2 className="account-transactions-title">
            {lang === "es" ? "Transacciones" : "Transactions"}
          </h2>

          {txLoading ? (
            <div className="account-transactions-list">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="account-tx-skeleton h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : (transactions as TransactionItem[]).length === 0 ? (
            <div className="account-transactions-empty">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              <p>{lang === "es" ? "No hay transacciones" : "No transactions"}</p>
            </div>
          ) : (
            <div className="account-transactions-grouped">
              {Object.entries(groupedTransactions).map(([monthKey, days]) => (
                <div key={monthKey} className="account-tx-month-group">
                  <h3 className="account-tx-month-header">
                    {formatMonthYear(monthKey + "-01")}
                  </h3>
                  <div className="account-tx-days">
                    {Object.entries(days).map(([dayKey, txs]) => (
                      <div key={dayKey} className="account-tx-day-group">
                        <div className="account-tx-day-header">
                          {formatDayMonth(dayKey)}
                        </div>
                        <div className="account-tx-day-items">
                          {txs.map((tx) => (
                            <div key={tx.id} className={`account-transaction-item ${tx.type}`}>
                              <span className="account-transaction-desc">
                                {tx.description || (tx.type === "income" ? (lang === "es" ? "Ingreso" : "Income") : (lang === "es" ? "Gasto" : "Expense"))}
                              </span>
                              <span className={`account-transaction-amount ${tx.type}`}>
                                {tx.type === "income" ? "+" : "-"}{formatCurrency(Number(tx.amount))}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--danger-soft)] mx-auto mb-2">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </div>
            <AlertDialogTitle className="text-center">
              {t("accounts.delete")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              {t("accounts.deleteConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center gap-3">
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteAccount.isPending}
            >
              {deleteAccount.isPending && <Spinner className="size-4 mr-2" />}
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
