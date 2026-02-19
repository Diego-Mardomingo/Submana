"use client";

import { useState } from "react";
import { useAccounts } from "@/hooks/useAccounts";
import {
  useCreateAccount,
  useUpdateAccount,
  useDeleteAccount,
} from "@/hooks/useAccountMutations";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { useLang } from "@/hooks/useLang";
import { useTranslations } from "@/lib/i18n/utils";

export default function AccountsBody() {
  const lang = useLang();
  const t = useTranslations(lang);
  const queryClient = useQueryClient();
  const { data: accounts = [], isLoading } = useAccounts();
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();
  const deleteAccount = useDeleteAccount();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [currentAccount, setCurrentAccount] = useState<{
    id: string;
    name: string;
    balance: number;
    icon?: string;
    color?: string;
  } | null>(null);
  const [formData, setFormData] = useState({
    id: "",
    name: "",
    balance: "",
    icon: "",
    color: "#7c3aed",
  });
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<string | null>(null);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const colors = ["#7c3aed", "#3b82f6", "#10b981", "#f43f5e", "#f59e0b", "#64748b"];

  const resetForm = () => {
    setFormData({
      id: "",
      name: "",
      balance: "",
      icon: "",
      color: "#7c3aed",
    });
    setModalMode("create");
    setCurrentAccount(null);
  };

  const openModal = (
    mode: "create" | "edit",
    account?: { id: string; name: string; balance: number; icon?: string; color?: string }
  ) => {
    setIsModalOpen(true);
    setModalMode(mode);
    if (mode === "edit" && account) {
      setFormData({
        id: account.id,
        name: account.name,
        balance: String(account.balance),
        icon: account.icon || "",
        color: account.color || "#7c3aed",
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const balance = parseFloat(formData.balance);
    if (isNaN(balance) || !formData.name) return;

    if (modalMode === "create") {
      await createAccount.mutateAsync({
        name: formData.name,
        balance,
        icon: formData.icon || undefined,
        color: formData.color,
      });
    } else if (formData.id) {
      await updateAccount.mutateAsync({
        id: formData.id,
        name: formData.name,
        balance,
        icon: formData.icon || undefined,
        color: formData.color,
      });
    }
    closeModal();
  };

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountToDelete) return;
    await deleteAccount.mutateAsync(accountToDelete);
    setDeleteModalOpen(false);
    setAccountToDelete(null);
  };

  const handleSetDefault = async (account: { id: string }) => {
    queryClient.setQueryData(queryKeys.accounts.lists(), (old: unknown) => {
      const list = Array.isArray(old) ? old : [];
      return list.map((acc: unknown) => {
        const a = acc as { id: string; is_default?: boolean };
        return { ...a, is_default: a.id === account.id };
      });
    });
    try {
      await fetch("/api/accounts/set-default", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: account.id }),
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
    } catch {
      await queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
    }
  };

  if (isLoading) {
    return (
      <div className="page-container">
        <header className="page-header">
          <div className="title-with-icon">
            <div className="skeleton" style={{ width: 28, height: 28 }} />
            <h1 className="title">{t("accounts.title")}</h1>
          </div>
        </header>
        <div className="accounts-grid">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: 140, borderRadius: 16 }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="page-container fade-in">
      <header className="page-header">
        <div className="title-with-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="title-icon">
            <rect x="1" y="4" width="22" height="16" rx="2" />
            <line x1="1" y1="10" x2="23" y2="10" />
          </svg>
          <h1 className="title">{t("accounts.title")}</h1>
        </div>
        <button type="button" className="add-btn" onClick={() => openModal("create")}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>{t("accounts.add")}</span>
        </button>
      </header>
      <div className="accounts-grid">
        {accounts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <rect x="1" y="4" width="22" height="16" rx="2" />
                <line x1="1" y1="10" x2="23" y2="10" />
              </svg>
            </div>
            <p>{t("accounts.noAccounts")}</p>
          </div>
        ) : (
          (accounts as Array<{ id: string; name: string; balance: number; icon?: string; color?: string; is_default?: boolean }>).map((account) => (
            <div
              key={account.id}
              className="account-card"
              style={{ "--accent-account": account.color || "var(--accent)" } as React.CSSProperties}
            >
              <div className="card-content">
                <div className="account-icon-wrapper">
                  {account.icon ? (
                    <img src={account.icon} alt={account.name} className="account-img" />
                  ) : (
                    <div className="account-icon-fallback" style={{ color: account.color || "var(--accent)" }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="1" y="4" width="22" height="16" rx="2" />
                        <line x1="1" y1="10" x2="23" y2="10" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="account-info">
                  <h3 className="account-name">{account.name}</h3>
                  <p className="account-balance">{Number(account.balance).toFixed(2)} €</p>
                </div>
              </div>
              <button
                type="button"
                className={`favorite-btn ${account.is_default ? "is-default" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSetDefault(account);
                }}
                aria-label="Set as default"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill={account.is_default ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </button>
              <div className="card-actions">
                <button type="button" className="icon-btn edit-btn" onClick={() => openModal("edit", account)} aria-label="Edit">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                </button>
                <button type="button" className="icon-btn delete-btn" onClick={() => { setAccountToDelete(account.id); setDeleteModalOpen(true); }} aria-label="Delete">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {isModalOpen && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{modalMode === "create" ? t("accounts.add") : t("accounts.edit")}</h2>
            <form onSubmit={handleSave}>
              <div className="field">
                <label htmlFor="acc-name">{t("settings.name")}</label>
                <input
                  id="acc-name"
                  type="text"
                  required
                  placeholder="Ex. Main Bank"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="acc-balance">{t("accounts.balance")} (€)</label>
                <div className="currency-input" style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: "1rem", color: "var(--gris-claro)", top: "50%", transform: "translateY(-50%)" }}>€</span>
                  <input
                    id="acc-balance"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    style={{ paddingLeft: "2.5rem" }}
                    value={formData.balance}
                    onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
                  />
                </div>
              </div>
              <div className="field">
                <label>{t("common.color")}</label>
                <div style={{ position: "relative" }}>
                  <button
                    type="button"
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      backgroundColor: formData.color,
                      border: "3px solid var(--negro)",
                      cursor: "pointer",
                    }}
                    onClick={() => setColorPickerOpen(!colorPickerOpen)}
                  />
                  {colorPickerOpen && (
                    <div style={{
                      position: "absolute",
                      top: "100%",
                      marginTop: 8,
                      background: "var(--gris-oscuro)",
                      padding: 12,
                      borderRadius: 12,
                      display: "grid",
                      gridTemplateColumns: "repeat(3, 1fr)",
                      gap: 8,
                      zIndex: 2100,
                    }}>
                      {colors.map((c) => (
                        <button
                          key={c}
                          type="button"
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: "50%",
                            backgroundColor: c,
                            border: formData.color === c ? "2px solid var(--blanco)" : "none",
                            cursor: "pointer",
                          }}
                          onClick={() => { setFormData({ ...formData, color: c }); setColorPickerOpen(false); }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={closeModal}>
                  {t("common.cancel")}
                </button>
                <button type="submit" className="btn-save" disabled={createAccount.isPending || updateAccount.isPending}>
                  {t("common.save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteModalOpen && (
        <div className="modal-backdrop" onClick={() => setDeleteModalOpen(false)}>
          <div className="modal-content delete-confirm" onClick={(e) => e.stopPropagation()}>
            <h2>{t("common.areYouSure")}</h2>
            <p>{t("accounts.deleteConfirm")}</p>
            <div className="modal-actions">
              <button type="button" className="btn-cancel" onClick={() => setDeleteModalOpen(false)}>
                {t("common.cancel")}
              </button>
              <button type="button" className="btn-delete-final" onClick={handleDelete} disabled={deleteAccount.isPending}>
                {t("common.delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
