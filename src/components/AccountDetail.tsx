"use client";

import Link from "next/link";
import { useState, useCallback, useEffect, useMemo } from "react";
import { useDeleteAccount } from "@/hooks/useAccountMutations";
import { useTransactions } from "@/hooks/useTransactions";
import { useLang } from "@/hooks/useLang";
import { useTranslations } from "@/lib/i18n/utils";
import { parseDateString } from "@/lib/date";
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
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  type CarouselApi,
} from "@/components/ui/carousel";
import BankStatementUpload from "@/components/BankStatementUpload";
import { SwipeToReveal, SwipeToRevealGroup } from "@/components/SwipeToReveal";
import { useDeleteTransaction } from "@/hooks/useDeleteTransaction";
import { Pencil, Trash2 } from "lucide-react";
import type { BankProvider } from "@/lib/bankProviders";

interface Account {
  id: string;
  name: string;
  balance: number;
  icon?: string;
  color?: string;
  is_default?: boolean;
  bank_provider?: string | null;
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
  const [txToDelete, setTxToDelete] = useState<TransactionItem | null>(null);
  const [showDeleteTx, setShowDeleteTx] = useState(false);
  const deleteAccount = useDeleteAccount();
  const deleteTransaction = useDeleteTransaction();

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
    const d = parseDateString(dateStr);
    const day = d.getDate().toString().padStart(2, "0");
    const month = (d.getMonth() + 1).toString().padStart(2, "0");
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const formatMonthYear = (dateStr: string) => {
    const d = parseDateString(dateStr);
    const months = lang === "es"
      ? ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
      : ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return `${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  const formatDayMonth = (dateStr: string) => {
    const d = parseDateString(dateStr);
    const day = d.getDate();
    const months = lang === "es"
      ? ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
      : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${day} ${months[d.getMonth()]}`;
  };

  const groupTransactionsByMonthAndDay = (txs: TransactionItem[]) => {
    const sorted = [...txs].sort((a, b) => parseDateString(b.date).getTime() - parseDateString(a.date).getTime());
    const byMonth: Record<string, Record<string, TransactionItem[]>> = {};

    for (const tx of sorted) {
      const d = parseDateString(tx.date);
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

  const months = useMemo(() => {
    const txs = transactions as TransactionItem[];
    if (!txs.length) {
      return [{ year: currentYear, month: currentMonth }];
    }
    const dates = txs.map((tx) => parseDateString(tx.date));
    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
    const result: { year: number; month: number }[] = [];
    let y = minDate.getFullYear();
    let m = minDate.getMonth();
    const endY = currentYear;
    const endM = currentMonth;
    while (y < endY || (y === endY && m <= endM)) {
      result.push({ year: y, month: m });
      m++;
      if (m > 11) {
        m = 0;
        y++;
      }
    }
    return result.length ? result : [{ year: currentYear, month: currentMonth }];
  }, [transactions, currentYear, currentMonth]);

  const getMonthStats = useCallback(
    (year: number, month: number) => {
      const monthTxs = (transactions as TransactionItem[]).filter((tx) => {
        const d = parseDateString(tx.date);
        return d.getFullYear() === year && d.getMonth() === month;
      });
      const income = monthTxs
        .filter((tx) => tx.type === "income")
        .reduce((sum, tx) => sum + Number(tx.amount), 0);
      const expense = monthTxs
        .filter((tx) => tx.type === "expense")
        .reduce((sum, tx) => sum + Number(tx.amount), 0);
      return {
        income,
        expense,
        balance: income - expense,
        count: monthTxs.length,
        incomeCount: monthTxs.filter((tx) => tx.type === "income").length,
        expenseCount: monthTxs.filter((tx) => tx.type === "expense").length,
      };
    },
    [transactions]
  );

  const formatMonthYearDisplay = (year: number, month: number) => {
    const monthsNames =
      lang === "es"
        ? ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
        : ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return `${monthsNames[month]} ${year}`;
  };

  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [selectedIndex, setSelectedIndex] = useState(
    months.findIndex((m) => m.year === currentYear && m.month === currentMonth)
  );

  const carouselOpts = useMemo(
    () => ({
      align: "center" as const,
      loop: false,
      duration: 25,
      startIndex: (() => {
        const idx = months.findIndex((m) => m.year === currentYear && m.month === currentMonth);
        return idx >= 0 ? idx : Math.max(0, months.length - 1);
      })(),
    }),
    [months, currentYear, currentMonth]
  );

  useEffect(() => {
    if (!carouselApi) return;
    const updateIndex = () => setSelectedIndex(carouselApi.selectedScrollSnap());
    updateIndex();
    carouselApi.on("select", updateIndex);
    carouselApi.on("scroll", updateIndex);
    return () => {
      carouselApi.off("select", updateIndex);
      carouselApi.off("scroll", updateIndex);
    };
  }, [carouselApi]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (!carouselApi) return;

      if (e.key === "ArrowLeft" && carouselApi.canScrollPrev()) {
        e.preventDefault();
        carouselApi.scrollPrev();
      } else if (e.key === "ArrowRight" && carouselApi.canScrollNext()) {
        e.preventDefault();
        carouselApi.scrollNext();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [carouselApi]);

  const accentColor = account.color || "var(--accent)";

  return (
    <>
      <div 
        className="account-detail"
        style={{ "--account-accent": accentColor } as React.CSSProperties}
      >
        <div className="account-detail-header">
          <div className="account-detail-icon-wrapper">
            <div className="account-detail-icon">
              {account.icon ? (
                <img src={account.icon} alt={account.name} />
              ) : (
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={accentColor}
                  strokeWidth="1.5"
                >
                  <rect x="1" y="4" width="22" height="16" rx="2" />
                  <line x1="1" y1="10" x2="23" y2="10" />
                </svg>
              )}
            </div>
            {account.name?.toLowerCase().includes("remunerada") && (
              <div className="account-badge-interest account-badge-interest-lg" title={lang === "es" ? "Cuenta remunerada" : "Savings account"}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                  <polyline points="17 6 23 6 23 12" />
                </svg>
              </div>
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

        <div className="account-stats-carousel">
          <div className="account-stats-month-header">
            <button
              type="button"
              className="account-stats-month-title"
              onClick={() => {
                const currentIdx = months.findIndex(
                  (m) => m.year === currentYear && m.month === currentMonth
                );
                if (currentIdx >= 0 && carouselApi) {
                  carouselApi.scrollTo(currentIdx);
                }
              }}
              title={lang === "es" ? "Ir al mes actual" : "Go to current month"}
            >
              {months[selectedIndex] && formatMonthYearDisplay(months[selectedIndex].year, months[selectedIndex].month)}
              {months[selectedIndex] && (months[selectedIndex].year !== currentYear || months[selectedIndex].month !== currentMonth) && (
                <svg className="account-stats-home-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              )}
            </button>
          </div>
          <Carousel
            opts={carouselOpts}
            setApi={setCarouselApi}
            className="account-stats-carousel-inner"
          >
            <CarouselContent>
              {months.map(({ year, month }) => {
                const stats = getMonthStats(year, month);
                const balanceClass =
                  stats.balance > 0 ? "positive" : stats.balance < 0 ? "negative" : "neutral";
                return (
                  <CarouselItem key={`${year}-${month}`}>
                    <div className="account-detail-stats">
                      <div className={`account-stat-card balance ${balanceClass}`}>
                        <span className="account-stat-label">{lang === "es" ? "Balance del Mes" : "Month Balance"}</span>
                        <span className="account-stat-value account-stat-value-balance">
                          {stats.balance >= 0 ? "+" : ""}{formatCurrency(stats.balance)}
                        </span>
                      </div>
                      <div className="account-stat-card account-stat-transactions">
                        <span className="account-stat-label">{lang === "es" ? "Transacciones" : "Transactions"}</span>
                        <div className="account-stat-row">
                          <span className="account-stat-value">{stats.count}</span>
                          <span className="account-stat-separator">|</span>
                          <span className="account-stat-inline income">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <polyline points="17 11 12 6 7 11" />
                            </svg>
                            {stats.incomeCount}
                          </span>
                          <span className="account-stat-inline expense">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <polyline points="7 13 12 18 17 13" />
                            </svg>
                            {stats.expenseCount}
                          </span>
                        </div>
                      </div>
                      <div className="account-stat-card income">
                        <span className="account-stat-label">{lang === "es" ? "Ingresos" : "Income"}</span>
                        <span className="account-stat-value">{formatCurrency(stats.income)}</span>
                      </div>
                      <div className="account-stat-card expense">
                        <span className="account-stat-label">{lang === "es" ? "Gastos" : "Expenses"}</span>
                        <span className="account-stat-value">{formatCurrency(stats.expense)}</span>
                      </div>
                    </div>
                  </CarouselItem>
                );
              })}
            </CarouselContent>
            <CarouselPrevious className="account-stats-carousel-nav account-stats-carousel-prev" />
            <CarouselNext className="account-stats-carousel-nav account-stats-carousel-next" />
          </Carousel>
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

        {account.bank_provider && (account.bank_provider === "trade_republic" || account.bank_provider === "revolut") && (
          <BankStatementUpload
            accountId={account.id}
            bankProvider={account.bank_provider as BankProvider}
          />
        )}

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
                        <SwipeToRevealGroup className="account-tx-day-items">
                          {txs.map((tx) => (
                            <SwipeToReveal
                              key={tx.id}
                              id={tx.id}
                              className="account-tx-swipe-wrapper"
                              swipeHint
                              desktopMinWidth={1024}
                              actions={
                                <div className="account-tx-actions-reveal flex items-center gap-2">
                                  <Link
                                    href={`/transactions/edit/${tx.id}`}
                                    className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--accent)] transition-colors hover:bg-[var(--accent-soft)]"
                                    aria-label={t("common.edit")}
                                  >
                                    <Pencil className="size-5" />
                                  </Link>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      setTxToDelete(tx);
                                      setShowDeleteTx(true);
                                    }}
                                    className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--danger)] transition-colors hover:bg-[var(--danger-soft)]"
                                    aria-label={t("common.delete")}
                                  >
                                    <Trash2 className="size-5" />
                                  </button>
                                </div>
                              }
                            >
                              <div className={`account-transaction-item ${tx.type}`}>
                                <span className="account-transaction-desc">
                                  {tx.description || (tx.type === "income" ? (lang === "es" ? "Ingreso" : "Income") : (lang === "es" ? "Gasto" : "Expense"))}
                                </span>
                                <span className={`account-transaction-amount ${tx.type}`}>
                                  {tx.type === "income" ? "+" : "-"}{formatCurrency(Number(tx.amount))}
                                </span>
                              </div>
                            </SwipeToReveal>
                          ))}
                        </SwipeToRevealGroup>
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
            {(transactions as TransactionItem[]).length > 0 && (
              <div className="mt-3 p-3 rounded-lg bg-[var(--danger-soft)] border border-[var(--danger)] text-center">
                <p className="text-sm font-medium text-[var(--danger)]">
                  {lang === "es" 
                    ? `⚠️ Se eliminarán ${(transactions as TransactionItem[]).length} transaccion${(transactions as TransactionItem[]).length === 1 ? '' : 'es'} asociadas a esta cuenta`
                    : `⚠️ ${(transactions as TransactionItem[]).length} transaction${(transactions as TransactionItem[]).length === 1 ? '' : 's'} associated with this account will be deleted`}
                </p>
              </div>
            )}
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

      <AlertDialog open={showDeleteTx} onOpenChange={setShowDeleteTx}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--danger-soft)] mx-auto mb-2">
              <Trash2 className="size-7 text-[var(--danger)]" />
            </div>
            <AlertDialogTitle className="text-center">
              {t("transactions.delete")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              {txToDelete && (
                <span>
                  {txToDelete.description || (txToDelete.type === "income" ? t("transactions.income") : t("transactions.expense"))}
                  {" - "}
                  {formatCurrency(Number(txToDelete.amount))}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center gap-3">
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (txToDelete) {
                  deleteTransaction.mutate(txToDelete.id);
                  setShowDeleteTx(false);
                  setTxToDelete(null);
                }
              }}
              disabled={deleteTransaction.isPending}
            >
              {deleteTransaction.isPending && <Spinner className="size-4 mr-2" />}
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
