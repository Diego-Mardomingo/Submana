import React, { useState, useEffect } from "react";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { queryClient } from "../lib/queryClient";
import { useAccounts } from "../hooks/useAccounts";
import { ui } from "../i18n/ui";
import Icon from "./Icon";
import ShowToast from "./ShowToast";
import "../styles/AccountsBody.css";

export default function AccountsBody({ lang }) {
    return (
        <QueryClientProvider client={queryClient}>
            <AccountsBodyInner lang={lang} />
            <ShowToast />
        </QueryClientProvider>
    );
}

function AccountsBodyInner({ lang }) {
    const t = (key) => ui[lang]?.[key] || ui['en'][key];
    const { data: accountsRaw, isLoading } = useAccounts();
    // Sort logic might be needed if API doesn't guarantee, but existing API now does ascending.
    const accounts = accountsRaw || [];

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'
    const [currentAccount, setCurrentAccount] = useState(null);

    // Form State
    const [formData, setFormData] = useState({
        id: '',
        name: '',
        balance: '',
        icon: '',
        color: '#7c3aed'
    });

    // Delete Modal
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [accountToDelete, setAccountToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Color Picker State
    const [colorPickerOpen, setColorPickerOpen] = useState(false);
    const colors = ['#7c3aed', '#3b82f6', '#10b981', '#f43f5e', '#f59e0b', '#64748b'];

    const resetForm = () => {
        setFormData({
            id: '',
            name: '',
            balance: '',
            icon: '',
            color: '#7c3aed'
        });
        setModalMode('create');
        setCurrentAccount(null);
    };

    const openModal = (mode, account = null) => {
        setIsModalOpen(true);
        setModalMode(mode);
        if (mode === 'edit' && account) {
            setFormData({
                id: account.id,
                name: account.name,
                balance: account.balance,
                icon: account.icon,
                color: account.color || '#7c3aed'
            });
            setCurrentAccount(account);
        } else {
            resetForm();
        }
    };

    const closeModal = () => {
        setIsModalOpen(false);
        resetForm();
    };

    const handleColorSelect = (color) => {
        setFormData(prev => ({ ...prev, color }));
        setColorPickerOpen(false);
    };

    const handleIconSelect = (icon) => {
        setFormData(prev => ({ ...prev, icon }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setIsSaving(true);

        const endpoint = modalMode === 'create' ? '/api/crud/create-account' : '/api/crud/update-account';
        const body = new URLSearchParams();
        Object.keys(formData).forEach(key => {
            if (formData[key] !== null && formData[key] !== undefined) {
                body.append(key, formData[key]);
            }
        });

        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                body: body
            });
            if (res.ok || res.status === 303) {
                await queryClient.invalidateQueries({ queryKey: ['accounts'] });
                closeModal();
            } else {
                console.error("Failed to save account");
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };

    const openDeleteModalFn = (id) => {
        setAccountToDelete(id);
        setDeleteModalOpen(true);
    };

    const closeDeleteModal = () => {
        setDeleteModalOpen(false);
        setAccountToDelete(null);
    };

    const handleDelete = async (e) => {
        e.preventDefault();
        if (!accountToDelete) return;

        setIsDeleting(true);
        try {
            const res = await fetch('/api/crud/delete-account', {
                method: 'POST',
                body: new URLSearchParams({ id: accountToDelete })
            });

            if (res.ok || res.status === 303) {
                await queryClient.invalidateQueries({ queryKey: ['accounts'] });
                closeDeleteModal();
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleSetDefault = async (account) => {
        // Optimistic update logic is tricky with query invalidation, but let's try just invalidating
        // or we can manually update cache. For simplicity, just call API and invalidate.
        // Actually, for instant feedback, we should locally update state if we were managing it, 
        // but react-query cache update is best.

        // Optimistic UI update:
        queryClient.setQueryData(['accounts', 'lists'], (old) => {
            if (!old) return old;
            return old.map(acc => ({
                ...acc,
                is_default: acc.id === account.id
            }));
        });

        try {
            const formData = new FormData();
            formData.append('id', account.id);
            await fetch('/api/accounts/set-default', {
                method: 'POST',
                body: formData
            });
            await queryClient.invalidateQueries({ queryKey: ['accounts'] });
        } catch (err) {
            console.error(err);
            await queryClient.invalidateQueries({ queryKey: ['accounts'] }); // Revert on error
        }
    };

    // Translations for Icon component
    const iconTranslations = {
        'sub.selected': t('sub.selected'),
        'sub.brandIcon': t('sub.brandIcon'),
        'sub.searchPlaceholder': t('sub.searchPlaceholder'),
        'sub.startTyping': t('sub.startTyping'),
        'sub.searching': t('sub.searching'),
        'sub.noIconsFound': t('sub.noIconsFound'),
        'sub.randomAvatar': t('sub.randomAvatar')
    };

    if (isLoading) {
        return <AccountsSkeleton t={t} />;
    }

    return (
        <div className="page-container fade-in">
            <header className="page-header">
                <div className="title-with-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="title-icon"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>
                    <h1 className="title">{t('accounts.title')}</h1>
                </div>
                <button className="add-btn" onClick={() => openModal('create')}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    <span>{t('accounts.add')}</span>
                </button>
            </header>

            <div className="accounts-grid">
                {accounts.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>
                        </div>
                        <p>{t('accounts.noAccounts')}</p>
                    </div>
                ) : (
                    accounts.map(account => (
                        <div className="account-card" key={account.id} style={{ '--accent-account': account.color || 'var(--accent)' }}>
                            <div className="card-content">
                                <div className="account-icon-wrapper">
                                    {account.icon ? (
                                        <img src={account.icon} alt={account.name} className="account-img" />
                                    ) : (
                                        <div className="account-icon-fallback">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>
                                        </div>
                                    )}
                                </div>
                                <div className="account-info">
                                    <h3 className="account-name">{account.name}</h3>
                                    <p className="account-balance">{parseFloat(account.balance).toFixed(2)} €</p>
                                </div>
                            </div>

                            <button
                                className={`favorite-btn ${account.is_default ? 'is-default' : ''}`}
                                onClick={(e) => { e.stopPropagation(); handleSetDefault(account); }}
                                aria-label="Set as Default"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill={account.is_default ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                            </button>

                            <div className="card-actions">
                                <button className="icon-btn edit-btn" onClick={() => openModal('edit', account)} aria-label="Edit">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                                </button>
                                <button className="icon-btn delete-btn" onClick={() => openDeleteModalFn(account.id)} aria-label="Delete">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Create/Edit Modal */}
            {isModalOpen && (
                <div className="modal-backdrop">
                    <div className="modal-content">
                        <h2 id="modal-title">{modalMode === 'create' ? t('accounts.add') : t('accounts.edit') || 'Edit Account'}</h2>
                        <form onSubmit={handleSave}>

                            <div className="field">
                                <label htmlFor="acc-name">{t('settings.name')}</label>
                                <input
                                    type="text"
                                    id="acc-name"
                                    required
                                    placeholder="Ex. Main Bank"
                                    autoComplete="off"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            <div className="form-grid">
                                <div className="field">
                                    <label htmlFor="acc-balance">{t('accounts.balance')} (€)</label>
                                    <div className="currency-input">
                                        <span className="currency-symbol">€</span>
                                        <input
                                            type="number"
                                            id="acc-balance"
                                            step="0.01"
                                            placeholder="0.00"
                                            value={formData.balance}
                                            onChange={e => setFormData({ ...formData, balance: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="field">
                                    <label>{t('common.color') || 'Color'}</label>
                                    <div className="color-picker-custom">
                                        <button
                                            type="button"
                                            className="color-dot-trigger"
                                            style={{ backgroundColor: formData.color }}
                                            onClick={() => setColorPickerOpen(!colorPickerOpen)}
                                        ></button>
                                        {colorPickerOpen && (
                                            <>
                                                <div className="color-options-grid">
                                                    {colors.map(color => (
                                                        <button
                                                            key={color}
                                                            type="button"
                                                            className={`color-option-dot ${formData.color === color ? 'selected' : ''}`}
                                                            style={{ backgroundColor: color }}
                                                            onClick={() => handleColorSelect(color)}
                                                        ></button>
                                                    ))}
                                                </div>
                                                <div className="fixed inset-0 z-[2099]" onClick={() => setColorPickerOpen(false)}></div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="field">
                                <label>{t('sub.icon')}</label>
                                <div className="icon-selector-wrapper no-scroll">
                                    <Icon
                                        defaultIcon={formData.icon}
                                        onIconSelected={handleIconSelect}
                                        translations={iconTranslations}
                                    />
                                </div>
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="btn-cancel" onClick={closeModal}>{t('common.cancel')}</button>
                                <button type="submit" className={`btn-save ${isSaving ? 'btn-loading' : ''}`}>
                                    {t('common.save')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteModalOpen && (
                <div className="modal-backdrop">
                    <div className="modal-content delete-confirm">
                        <div className="delete-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        </div>
                        <h2>{t('common.areYouSure') || 'Are you sure?'}</h2>
                        <p>{t('accounts.deleteConfirm') || 'This action cannot be undone.'}</p>

                        <div className="modal-actions full-width">
                            <button type="button" className="btn-cancel" onClick={closeDeleteModal}>{t('common.cancel')}</button>
                            <button type="button" className={`btn-delete-final ${isDeleting ? 'btn-loading' : ''}`} onClick={handleDelete}>{t('common.delete') || 'Delete'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function AccountsSkeleton({ t }) {
    return (
        <div className="page-container">
            <header className="page-header">
                <div className="title-with-icon">
                    <div className="skeleton" style={{ width: '28px', height: '28px' }}></div>
                    <h1 className="title">{t('accounts.title')}</h1>
                </div>
                <div className="skeleton-btn" style={{ width: '100px', height: '40px', borderRadius: '8px', background: 'var(--gris-oscuro)' }}></div>
            </header>
            <div className="accounts-grid">
                {[1, 2, 3].map(i => (
                    <div className="skeleton" key={i} style={{ height: '140px', borderRadius: '16px', background: 'var(--gris-oscuro)' }}></div>
                ))}
            </div>
        </div>
    );
}
