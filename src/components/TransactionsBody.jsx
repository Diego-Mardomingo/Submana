import React, { useState, useEffect } from "react";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { queryClient } from "../lib/queryClient";
import { useTransactions } from "../hooks/useTransactions";
import { ui } from "../i18n/ui";
import "../styles/TransactionsBody.css";

export default function TransactionsBody(props) {
    return (
        <QueryClientProvider client={queryClient}>
            <TransactionsBodyInner {...props} />
        </QueryClientProvider>
    );
}

function TransactionsBodyInner({ lang }) {
    const t = (key) => ui[lang]?.[key] || ui['en'][key];
    const { data: transactions, isLoading } = useTransactions();
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [transactionToDelete, setTransactionToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Helper for formatting date
    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' });
    };

    // Group transactions by date
    const groupedTransactions = (transactions || []).reduce((acc, transaction) => {
        const date = transaction.date.split('T')[0]; // Ensure YYYY-MM-DD
        if (!acc[date]) {
            acc[date] = [];
        }
        acc[date].push(transaction);
        return acc;
    }, {});

    const sortedDates = Object.keys(groupedTransactions).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    // Delete handlers
    const openDeleteModal = (id) => {
        setTransactionToDelete(id);
        setDeleteModalOpen(true);
    };

    const closeDeleteModal = () => {
        setDeleteModalOpen(false);
        setTransactionToDelete(null);
    };

    const handleDelete = async (e) => {
        e.preventDefault();
        if (!transactionToDelete) return;

        setIsDeleting(true);
        try {
            const res = await fetch('/api/crud/delete-transaction', {
                method: 'POST',
                body: new URLSearchParams({ id: transactionToDelete })
            });

            if (res.ok || res.status === 303) { // 303 is redirect, effectively success here
                // In a perfect world we'd use a mutation hook here, but since the original used a form submit, 
                // let's rely on query invalidation or manual update. 
                // Actually, the original used a form action which caused a full reload.
                // Here we are in React. We should ideally invalidate queries.
                await queryClient.invalidateQueries({ queryKey: ['transactions'] });
                closeDeleteModal();
            } else {
                console.error("Failed to delete");
            }
        } catch (error) {
            console.error("Error deleting:", error);
        } finally {
            setIsDeleting(false);
        }
    };


    if (isLoading) {
        return <TransactionsSkeleton t={t} />;
    }

    return (
        <div className="page-container fade-in">
            <header className="page-header">
                <div className="title-with-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="title-icon"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M5 21v-16a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v16l-3 -2l-2 2l-2 -2l-2 2l-2 -2l-3 2" /><path d="M15 7.8c-.523 -.502 -1.172 -.8 -1.875 -.8c-1.727 0 -3.125 1.791 -3.125 4s1.398 4 3.125 4c.703 0 1.352 -.298 1.874 -.8" /><path d="M9 11h4" /></svg>
                    <h1 className="title">{t('transactions.title')}</h1>
                </div>
                <a href="/transactions/new" className="add-btn" aria-label={t('transactions.add')}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    <span className="btn-text">{t('transactions.add')}</span>
                </a>
            </header>

            <div className="transactions-list">
                {(!transactions || transactions.length === 0) ? (
                    <div className="empty-state">
                        <div className="empty-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M5 21v-16a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v16l-3 -2l-2 2l-2 -2l-2 2l-2 -2l-3 2" /><path d="M15 7.8c-.523 -.502 -1.172 -.8 -1.875 -.8c-1.727 0 -3.125 1.791 -3.125 4s1.398 4 3.125 4c.703 0 1.352 -.298 1.874 -.8" /><path d="M9 11h4" /></svg>
                        </div>
                        <p>{t('transactions.noTransactions')}</p>
                    </div>
                ) : (
                    sortedDates.map(date => (
                        <div className="day-group" key={date}>
                            <h3 className="date-header">{formatDate(date)}</h3>
                            <div className="day-transactions">
                                {groupedTransactions[date].map(transaction => (
                                    <div className="transaction-item" key={transaction.id}>
                                        <div className="tx-main">
                                            <div className={`tx-icon ${transaction.type}`}>
                                                {transaction.type === 'income' ? (
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
                                                ) : (
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline><polyline points="17 18 23 18 23 12"></polyline></svg>
                                                )}
                                            </div>
                                            <div className="tx-details">
                                                <span className="tx-desc">{transaction.description || transaction.category?.name || 'Untitled'}</span>
                                                <div className="tx-subtext">
                                                    <span className="badged-wrapper">
                                                        <span className="badge account-badge" style={transaction.account?.color ? { backgroundColor: `${transaction.account.color}15`, color: transaction.account.color, borderColor: `${transaction.account.color}30` } : {}}>
                                                            {transaction.account?.name}
                                                        </span>

                                                        {transaction.category && (
                                                            <>
                                                                <span className="badge category-badge">{transaction.category.name}</span>
                                                                {transaction.subcategory && (
                                                                    <>
                                                                        <span className="separator">•</span>
                                                                        <span className="badge subcategory-badge">{transaction.subcategory.name}</span>
                                                                    </>
                                                                )}
                                                            </>
                                                        )}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className={`tx-amount ${transaction.type}`}>
                                            {transaction.type === 'income' ? '+' : '-'}{parseFloat(transaction.amount).toFixed(2)} €
                                        </div>

                                        <div className="tx-actions">
                                            <a href={`/transactions/edit/${transaction.id}`} className="tx-action-btn edit-btn" aria-label="Edit">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                                            </a>
                                            <button className="tx-action-btn delete-btn" onClick={() => openDeleteModal(transaction.id)} aria-label="Delete">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Delete Confirmation Modal */}
            {deleteModalOpen && (
                <div className="modal-backdrop">
                    <div className="modal-content delete-confirm">
                        <div className="delete-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        </div>
                        <h2>{t('common.areYouSure') || 'Are you sure?'}</h2>
                        <p>{t('transactions.deleteConfirm') || 'This transaction will be permanently deleted.'}</p>

                        <div className="modal-actions full-width">
                            <button type="button" className="btn-cancel" onClick={closeDeleteModal}>{t('common.cancel')}</button>
                            <button type="button" className={`btn-delete-final ${isDeleting ? 'btn-loading' : ''}`} onClick={handleDelete}>
                                {t('common.delete') || 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function TransactionsSkeleton({ t }) {
    return (
        <div className="page-container">
            <header className="page-header">
                <div className="title-with-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" className="title-icon placeholder-icon" fill="#333" viewBox="0 0 24 24"><rect width="24" height="24" /></svg>
                    <h1 className="title">{t('transactions.title')}</h1>
                </div>
                <div className="skeleton-btn" style={{ width: '100px', height: '40px', borderRadius: '8px', background: 'var(--gris-oscuro)' }}></div>
            </header>
            <div className="transactions-list">
                {[1, 2, 3].map(i => (
                    <div className="day-group" key={i}>
                        <div className="skeleton" style={{ width: '150px', height: '20px', marginBottom: '10px' }}></div>
                        <div className="day-transactions" style={{ border: '1px solid var(--gris)', borderRadius: '12px', background: 'var(--gris-oscuro)' }}>
                            {[1, 2].map(j => (
                                <div className="transaction-item skeleton-item" key={j} style={{ padding: '1rem', display: 'flex', gap: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div className="skeleton circle" style={{ width: '40px', height: '40px', borderRadius: '50%' }}></div>
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <div className="skeleton" style={{ width: '60%', height: '16px' }}></div>
                                        <div className="skeleton" style={{ width: '40%', height: '12px' }}></div>
                                    </div>
                                    <div className="skeleton" style={{ width: '60px', height: '20px' }}></div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
