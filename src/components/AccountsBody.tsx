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
import { CurrencyInput, parseCurrencyValue } from "@/components/ui/currency-input";
import { ACCOUNT_BUDGET_COLORS, defaultAccountBudgetColor } from "@/lib/accountBudgetColors";
import { BANK_PROVIDER_LIST, getBankProvider, type BankProvider } from "@/lib/bankProviders";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
    bank_provider?: string | null;
  } | null>(null);
  const [formData, setFormData] = useState<{
    id: string;
    name: string;
    balance: string;
    icon: string;
    color: string;
    bank_provider: string;
  }>({
    id: "",
    name: "",
    balance: "",
    icon: "",
    color: defaultAccountBudgetColor,
    bank_provider: "",
  });
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<string | null>(null);
  const [transactionCount, setTransactionCount] = useState<number | null>(null);
  const [loadingTransactionCount, setLoadingTransactionCount] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const colors = ACCOUNT_BUDGET_COLORS;

  const resetForm = () => {
    setFormData({
      id: "",
      name: "",
      balance: "",
      icon: "",
      color: defaultAccountBudgetColor,
      bank_provider: "",
    });
    setModalMode("create");
    setCurrentAccount(null);
  };

  const openModal = (
    mode: "create" | "edit",
    account?: { id: string; name: string; balance: number; icon?: string; color?: string; bank_provider?: string | null }
  ) => {
    setIsModalOpen(true);
    setModalMode(mode);
    if (mode === "edit" && account) {
      setFormData({
        id: account.id,
        name: account.name,
        balance: account.balance !== undefined && account.balance !== null
          ? account.balance.toFixed(2).replace(".", ",")
          : "",
        icon: account.icon || "",
        color: account.color || defaultAccountBudgetColor,
        bank_provider: account.bank_provider || "",
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
    const balance = parseCurrencyValue(formData.balance);

    if (modalMode === "create") {
      await createAccount.mutateAsync({
        name: formData.name,
        balance,
        icon: formData.icon || undefined,
        color: formData.color,
        bank_provider: formData.bank_provider || null,
      });
    } else if (formData.id) {
      await updateAccount.mutateAsync({
        id: formData.id,
        name: formData.name,
        balance,
        icon: formData.icon || undefined,
        color: formData.color,
        bank_provider: formData.bank_provider || null,
      });
    }
    closeModal();
  };

  const openDeleteModal = async (accountId: string) => {
    setAccountToDelete(accountId);
    setTransactionCount(null);
    setDeleteModalOpen(true);
    setLoadingTransactionCount(true);
    try {
      const res = await fetch(`/api/crud/accounts/${accountId}`);
      const json = await res.json();
      if (json.data?.transaction_count !== undefined) {
        setTransactionCount(json.data.transaction_count);
      }
    } catch {
      setTransactionCount(0);
    } finally {
      setLoadingTransactionCount(false);
    }
  };

  const handleDelete = async () => {
    if (!accountToDelete) return;
    await deleteAccount.mutateAsync(accountToDelete);
    setDeleteModalOpen(false);
    setAccountToDelete(null);
    setTransactionCount(null);
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
          (accounts as Array<{ id: string; name: string; balance: number; icon?: string; color?: string; is_default?: boolean; bank_provider?: string | null }>).map((account) => (
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
                  {account.name?.toLowerCase().includes("remunerada") && (
                    <div className="account-badge-interest" title={lang === "es" ? "Cuenta remunerada" : "Savings account"}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                        <polyline points="17 6 23 6 23 12" />
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
                <div className="flex items-center gap-2">
                  <Label className="subs-form-label">{t("accounts.bankProvider")}</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" className="text-muted-foreground hover:text-foreground">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 16v-4" />
                            <path d="M12 8h.01" />
                          </svg>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{t("accounts.bankProviderTooltip")}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Select
                  value={formData.bank_provider || "none"}
                  onValueChange={(value) => {
                    if (value === "none") {
                      setFormData({ ...formData, bank_provider: "" });
                    } else {
                      const bankProvider = getBankProvider(value);
                      if (bankProvider) {
                        setFormData({
                          ...formData,
                          bank_provider: value,
                          name: formData.name || bankProvider.name,
                          icon: formData.icon || bankProvider.icon,
                        });
                      }
                    }
                  }}
                >
                  <SelectTrigger className="!h-10">
                    <SelectValue placeholder={t("accounts.bankProviderNone")}>
                      {formData.bank_provider ? (
                        <div className="flex items-center gap-2">
                          <img
                            src={getBankProvider(formData.bank_provider)?.icon}
                            alt=""
                            className="size-5 rounded"
                          />
                          <span>{getBankProvider(formData.bank_provider)?.name}</span>
                        </div>
                      ) : (
                        t("accounts.bankProviderNone")
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent style={{ zIndex: 2100 }}>
                    <SelectItem value="none">{t("accounts.bankProviderNone")}</SelectItem>
                    {BANK_PROVIDER_LIST.map((bank) => (
                      <SelectItem key={bank.id} value={bank.id}>
                        <div className="flex items-center gap-2">
                          <img src={bank.icon} alt="" className="size-5 rounded" />
                          <span>{bank.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
                <Label className="subs-form-label" htmlFor="acc-balance" optional>{t("accounts.balance")}</Label>
                <CurrencyInput
                  id="acc-balance"
                  placeholder="0,00"
                  value={formData.balance}
                  onChange={(value) => setFormData({ ...formData, balance: value })}
                  className="!h-10"
                />
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
                  <PopoverContent className="w-auto p-3" align="start" side="top" style={{ zIndex: 2100 }}>
                    <div className="grid grid-cols-4 gap-2">
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
            {loadingTransactionCount ? (
              <div className="flex items-center justify-center py-2">
                <Spinner className="size-5" />
              </div>
            ) : transactionCount !== null && transactionCount > 0 ? (
              <div className="mt-3 p-3 rounded-lg bg-[var(--danger-soft)] border border-[var(--danger)] text-center">
                <p className="text-sm font-medium text-[var(--danger)]">
                  {lang === "es" 
                    ? `⚠️ Se eliminarán ${transactionCount} transaccion${transactionCount === 1 ? '' : 'es'} asociadas a esta cuenta`
                    : `⚠️ ${transactionCount} transaction${transactionCount === 1 ? '' : 's'} associated with this account will be deleted`}
                </p>
              </div>
            ) : null}
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center gap-3">
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteAccount.isPending || loadingTransactionCount}
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
