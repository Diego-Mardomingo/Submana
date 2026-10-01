"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { AccountForm } from "@/components/AccountForm";
import { PageHeader } from "@/components/PageHeader";
import { SensitiveAmount } from "@/components/SensitiveAmount";
import { SortableContainer, SortableItem } from "@/components/Sortable";
import { AddButton } from "@/components/ui/add-button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAccounts, type Account } from "@/hooks/useAccounts";
import { useCreateDialog } from "@/hooks/useCreateDialog";
import { useLang } from "@/hooks/useLang";
import { useReorder } from "@/hooks/useReorder";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { useTranslations } from "@/lib/i18n/utils";
import { queryKeys } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";

const CardIcon = ({ size, strokeWidth = 2 }: { size?: number; strokeWidth?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}>
    <rect x="1" y="4" width="22" height="16" rx="2" />
    <line x1="1" y1="10" x2="23" y2="10" />
  </svg>
);

function AccountCardContent({ account, savingsLabel }: { account: Account; savingsLabel?: string }) {
  return (
    <div className="card-content">
      <div className="account-icon-wrapper">
        {account.icon ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote logos from arbitrary hosts
          <img src={account.icon} alt={account.name} className="account-img" />
        ) : (
          <div className="account-icon-fallback" style={{ color: account.color || "var(--accent)" }}>
            <CardIcon size={24} />
          </div>
        )}
        {savingsLabel && account.name.toLowerCase().includes("remunerada") && (
          <div className="account-badge-interest" title={savingsLabel}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
              <polyline points="17 6 23 6 23 12" />
            </svg>
          </div>
        )}
      </div>
      <div className="account-info">
        <h3 className="account-name">{account.name}</h3>
        <p className="account-balance">
          <SensitiveAmount>{formatCurrency(Number(account.balance))}</SensitiveAmount>
        </p>
      </div>
    </div>
  );
}

export default function AccountsBody() {
  const router = useRouter();
  const lang = useLang();
  const es = lang === "es";
  const t = useTranslations(lang);
  const queryClient = useQueryClient();
  const { data: accounts = [], isLoading } = useAccounts();
  const { handleReorder } = useReorder<Account>({ table: "accounts" });
  const [dialogOpen, setDialogOpen] = useCreateDialog();
  const bankSelectOpenRef = useRef(false);

  /** Marks the default account (moved first) used when creating transactions. */
  const setDefault = async (account: Account) => {
    queryClient.setQueryData<Account[]>(queryKeys.accounts.lists(), (old) => old?.map((a) => ({ ...a, is_default: a.id === account.id })));
    handleReorder([account, ...accounts.filter((a) => a.id !== account.id)]);
    try {
      await api("/api/accounts/set-default", "POST", { id: account.id });
    } catch {
      await queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
    }
  };

  const header = (
    <PageHeader icon={<CardIcon strokeWidth={2.5} />} title={t("accounts.title")} subtitle={t("accounts.heroSubtitle")}>
      {!isLoading && <AddButton onClick={() => setDialogOpen(true)}>{t("accounts.add")}</AddButton>}
    </PageHeader>
  );

  if (isLoading) {
    return (
      <div className="page-container">
        {header}
        <div className="info-stats-row single">
          <div className="skeleton" style={{ height: 90, borderRadius: 18, flex: 1 }} />
        </div>
        <div className="accounts-grid">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: 140, borderRadius: 16 }} />
          ))}
        </div>
      </div>
    );
  }

  const accentStyle = (account: Account) => ({ "--accent-account": account.color || "var(--accent)" }) as React.CSSProperties;
  return (
    <div className="page-container fade-in">
      {header}

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
              <span className="info-stat-label">{es ? "Balance Total" : "Total Balance"}</span>
              <span className="info-stat-value">
                <SensitiveAmount>{formatCurrency(accounts.reduce((sum, acc) => sum + Number(acc.balance), 0))}</SensitiveAmount>
              </span>
            </div>
          </div>
        </div>
      )}

      {accounts.length === 0 ? (
        <div className="accounts-grid">
          <div className="empty-state">
            <div className="empty-icon">
              <CardIcon size={48} strokeWidth={1} />
            </div>
            <p>{t("accounts.noAccounts")}</p>
          </div>
        </div>
      ) : (
        <SortableContainer
          items={accounts}
          onReorder={handleReorder}
          className="accounts-grid"
          strategy="grid"
          renderOverlay={(active) =>
            active && (
              <div className="account-card sortable-overlay" style={accentStyle(active)}>
                <AccountCardContent account={active} />
              </div>
            )
          }
          renderItem={(account) => (
            <SortableItem key={account.id} id={account.id}>
              <div
                role="button"
                tabIndex={0}
                className="account-card"
                style={accentStyle(account)}
                onClick={() => router.push(`/account/${account.id}`)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" && e.key !== " ") return;
                  e.preventDefault();
                  router.push(`/account/${account.id}`);
                }}
                aria-label={`${account.name} - ${formatCurrency(Number(account.balance))}`}
              >
                <AccountCardContent account={account} savingsLabel={es ? "Cuenta remunerada" : "Savings account"} />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className={cn("favorite-btn", account.is_default && "is-default")}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDefault(account);
                      }}
                      aria-label="Set as default"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill={account.is_default ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{es ? "Cuenta por defecto para crear transacciones" : "Default account for creating transactions"}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </SortableItem>
          )}
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className="sm:max-w-md max-h-[calc(100dvh-11rem)] md:max-h-[calc(100dvh-5rem)] overflow-y-auto overscroll-contain pb-4 !top-[calc(50%-40px)] md:!top-[50%]"
          onInteractOutside={(e) => bankSelectOpenRef.current && e.preventDefault()}
          onPointerDownOutside={(e) => bankSelectOpenRef.current && e.preventDefault()}
        >
          <DialogTitle className="sr-only">
            {t("accounts.add")} {t("accounts.title")}
          </DialogTitle>
          {dialogOpen && (
            <AccountForm onDone={() => setDialogOpen(false)} onCancel={() => setDialogOpen(false)} selectOpenRef={bankSelectOpenRef} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
