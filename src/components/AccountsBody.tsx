"use client";

import { useState } from "react";
import Link from "next/link";
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
import IconPicker from "@/components/IconPicker";
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
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { ACCOUNT_BUDGET_COLORS, defaultAccountBudgetColor } from "@/lib/accountBudgetColors";

const formatCurrency = (n: number) => {
  const formatted = new Intl.NumberFormat("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true,
  }).format(n);
  return `${formatted} €`;
};

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
  const [formData, setFormData] = useState<{
    id: string;
    name: string;
    balance: string;
    icon: string;
    color: string;
  }>({
    id: "",
    name: "",
    balance: "",
    icon: "",
    color: defaultAccountBudgetColor,
  });
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<string | null>(null);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const colors = ACCOUNT_BUDGET_COLORS;

  const resetForm = () => {
    setFormData({
      id: "",
      name: "",
      balance: "",
      icon: "",
      color: defaultAccountBudgetColor,
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
        color: account.color || defaultAccountBudgetColor,
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
    if (!formData.name) return;
    const balance =
      formData.balance === "" || isNaN(parseFloat(formData.balance))
        ? 0
        : parseFloat(formData.balance);

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

  const handleDelete = async () => {
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

  const totalBalance = (accounts as Array<{ balance: number }>).reduce(
    (sum, acc) => sum + Number(acc.balance), 0
  );

  return (
    <div className="page-container fade-in">
      {/* Page Header */}
      <header className="page-header-clean">
        <div className="page-header-left">
          <div className="page-header-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="1" y="4" width="22" height="16" rx="2" />
              <line x1="1" y1="10" x2="23" y2="10" />
            </svg>
          </div>
          <div className="page-header-text">
            <h1>{t("accounts.title")}</h1>
            <p>{t("accounts.heroSubtitle")}</p>
          </div>
        </div>
        <button type="button" className="add-btn" onClick={() => openModal("create")}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>{t("accounts.add")}</span>
        </button>
      </header>

      {/* Balance Card */}
      {accounts.length > 0 && (
        <div className="info-stats-row single">
          <div className="info-stat-card">
            <div className="info-stat-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
                <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
              </svg>
            </div>
            <div className="info-stat-content">
              <span className="info-stat-label">{lang === "es" ? "Balance Total" : "Total Balance"}</span>
              <span className="info-stat-value">{formatCurrency(totalBalance)}</span>
            </div>
          </div>
        </div>
      )}

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
            <Link
              key={account.id}
              href={`/account/${account.id}`}
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
                  <p className="account-balance">{formatCurrency(Number(account.balance))}</p>
                </div>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className={`favorite-btn ${account.is_default ? "is-default" : ""}`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleSetDefault(account);
                      }}
                      aria-label="Set as default"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill={account.is_default ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{lang === "es" ? "Cuenta por defecto para crear transacciones" : "Default account for creating transactions"}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Link>
          ))
        )}
      </div>

      {isModalOpen && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal-content modal-content-subs" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">{modalMode === "create" ? t("accounts.add") : t("accounts.edit")}</h2>
            <form onSubmit={handleSave} className="subs-form">
              <div className="subs-form-section">
                <Label className="subs-form-label" optional>{t("sub.icon")}</Label>
                <IconPicker
                  defaultIcon={formData.icon}
                  onIconSelect={(url) => setFormData({ ...formData, icon: url })}
                />
              </div>
              <div className="subs-form-section">
                <Label className="subs-form-label" htmlFor="acc-name" required>{t("settings.name")}</Label>
                <Input
                  id="acc-name"
                  type="text"
                  required
                  placeholder="Santander"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="!h-10"
                />
              </div>
              <div className="subs-form-section">
                <Label className="subs-form-label" htmlFor="acc-balance" optional>{t("accounts.balance")} (€)</Label>
                <InputGroup className="!h-10">
                  <InputGroupInput
                    id="acc-balance"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={formData.balance}
                    onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
                  />
                  <InputGroupAddon align="inline-end">€</InputGroupAddon>
                </InputGroup>
              </div>
              <div className="subs-form-section">
                <Label className="subs-form-label">{t("common.color")}</Label>
                <Popover open={colorPickerOpen} onOpenChange={setColorPickerOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="account-modal-color-btn"
                      style={{ backgroundColor: formData.color }}
                    />
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-3" align="start" style={{ zIndex: 2100 }}>
                    <div className="grid grid-cols-3 gap-2">
                      {colors.map((c) => (
                        <button
                          key={c}
                          type="button"
                          className="size-6 rounded-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                          style={{
                            backgroundColor: c,
                            border: formData.color === c ? "2px solid var(--blanco)" : "none",
                          }}
                          onClick={() => { setFormData({ ...formData, color: c }); setColorPickerOpen(false); }}
                        />
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="account-modal-actions">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={closeModal}
                  className="account-modal-cancel"
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  type="submit"
                  className="subs-form-submit account-modal-submit"
                  disabled={createAccount.isPending || updateAccount.isPending}
                >
                  {(createAccount.isPending || updateAccount.isPending) && <Spinner className="size-5 shrink-0" />}
                  {modalMode === "create" ? (lang === "es" ? "Crear" : "Create") : t("common.save")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AlertDialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--danger-soft)] mx-auto mb-2">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </div>
            <AlertDialogTitle className="text-center">{t("accounts.delete")}</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              {t("accounts.deleteConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center gap-3">
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteAccount.isPending}
              className="bg-[var(--danger)] hover:bg-[var(--danger-hover)] text-white"
            >
              {deleteAccount.isPending && <Spinner className="size-4 mr-2" />}
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
