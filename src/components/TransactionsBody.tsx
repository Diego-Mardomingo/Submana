"use client";

import { useState } from "react";

type TransactionItem = {
  id: string;
  date: string;
  amount: number;
  type: string;
  description?: string;
  account?: { name: string; color?: string };
  category?: { name: string };
  subcategory?: { name: string };
};
import Link from "next/link";
import { useTransactions } from "@/hooks/useTransactions";
import { useDeleteTransaction } from "@/hooks/useDeleteTransaction";
import { useLang } from "@/hooks/useLang";
import { useTranslations } from "@/lib/i18n/utils";

const formatCurrency = (n: number) => {
  const formatted = new Intl.NumberFormat("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true,
  }).format(n);
  return `${formatted} €`;
};

export default function TransactionsBody() {
  const lang = useLang();
  const t = useTranslations(lang);
  const { data: transactions = [], isLoading } = useTransactions();
  const deleteTransaction = useDeleteTransaction();

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(lang === "es" ? "es-ES" : "en-US", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  };

  const grouped = (transactions as TransactionItem[]).reduce(
    (acc, tx) => {
      const date = tx.date.split("T")[0];
      if (!acc[date]) acc[date] = [];
      acc[date].push(tx);
      return acc;
    },
    {} as Record<string, TransactionItem[]>
  );
  const sortedDates = Object.keys(grouped).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transactionToDelete) return;
    await deleteTransaction.mutateAsync(transactionToDelete);
    setDeleteModalOpen(false);
    setTransactionToDelete(null);
  };

  if (isLoading) {
    return (
      <div className="page-container">
        <header className="page-header">
          <h1 className="title">{t("transactions.title")}</h1>
        </header>
        <div className="skeleton" style={{ height: 200 }} />
      </div>
    );
  }

  return (
    <div className="page-container fade-in">
      <header className="page-header-clean">
        <div className="page-header-left">
          <div className="page-header-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 21v-16a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v16l-3 -2l-2 2l-2 -2l-2 2l-2 -2l-3 2" />
              <path d="M15 7.8c-.523 -.502 -1.172 -.8 -1.875 -.8c-1.727 0 -3.125 1.791 -3.125 4s1.398 4 3.125 4c.703 0 1.352 -.298 1.874 -.8" />
              <path d="M9 11h4" />
            </svg>
          </div>
          <div className="page-header-text">
            <h1>{t("transactions.title")}</h1>
            <p>{t("transactions.heroSubtitle")}</p>
          </div>
        </div>
        <Link href="/transactions/new" className="add-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>{t("transactions.add")}</span>
        </Link>
      </header>
      <div className="transactions-list">
        {sortedDates.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M5 21v-16a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v16l-3 -2l-2 2l-2 -2l-2 2l-2 -2l-3 2" />
              </svg>
            </div>
            <p>{t("transactions.noTransactions")}</p>
          </div>
        ) : (
          sortedDates.map((date) => (
            <div className="day-group" key={date}>
              <h3 className="date-header">{formatDate(date)}</h3>
              <div className="day-transactions">
                {grouped[date].map((tx: TransactionItem) => (
                  <div className="transaction-item" key={tx.id}>
                    <div className="tx-main">
                      <div className={`tx-icon ${tx.type}`}>
                        {tx.type === "income" ? (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                            <polyline points="17 6 23 6 23 12" />
                          </svg>
                        ) : (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
                            <polyline points="17 18 23 18 23 12" />
                          </svg>
                        )}
                      </div>
                      <div className="tx-details">
                        <span className="tx-desc">{tx.description || (tx.category as { name?: string })?.name || "Untitled"}</span>
                        <div className="tx-subtext">
                          {tx.account && (
                            <span
                              style={{
                                display: "inline-block",
                                padding: "2px 8px",
                                borderRadius: 6,
                                fontSize: "0.75rem",
                                backgroundColor: tx.account.color ? `${tx.account.color}20` : "var(--gris)",
                                color: tx.account.color || "var(--gris-claro)",
                              }}
                            >
                              {tx.account.name}
                            </span>
                          )}
                          {tx.category && (
                            <>
                              <span style={{ margin: "0 4px" }}>•</span>
                              <span>{(tx.category as { name: string }).name}</span>
                              {tx.subcategory && (
                                <>
                                  <span style={{ margin: "0 4px" }}>•</span>
                                  <span>{(tx.subcategory as { name: string }).name}</span>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className={`tx-amount ${tx.type}`}>
                      {tx.type === "income" ? "+" : "-"}
                      {formatCurrency(Number(tx.amount))}
                    </div>
                    <div className="tx-actions">
                      <Link href={`/transactions/edit/${tx.id}`} className="icon-btn edit-btn" aria-label="Edit">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                        </svg>
                      </Link>
                      <button
                        type="button"
                        className="icon-btn delete-btn"
                        onClick={() => {
                          setTransactionToDelete(tx.id);
                          setDeleteModalOpen(true);
                        }}
                        aria-label="Delete"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 6h18" />
                          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
      {deleteModalOpen && (
        <div className="modal-backdrop" onClick={() => setDeleteModalOpen(false)}>
          <div className="modal-content delete-confirm" onClick={(e) => e.stopPropagation()}>
            <h2>{t("common.areYouSure")}</h2>
            <p>{t("transactions.deleteConfirm")}</p>
            <div className="modal-actions">
              <button type="button" className="btn-cancel" onClick={() => setDeleteModalOpen(false)}>
                {t("common.cancel")}
              </button>
              <button type="button" className="btn-delete-final" onClick={handleDelete} disabled={deleteTransaction.isPending}>
                {t("common.delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
