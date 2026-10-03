"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Bones } from "@/components/Bones";
import { AccountDeleteWarning, AccountSheet, CardIcon } from "@/components/AccountSheet";
import { JointInvites } from "@/components/JointAccountSection";
import { ConfirmDeleteSheet } from "@/components/ConfirmSheet";
import { CompactPageHeader } from "@/components/PageHeader";
import { SensitiveAmount } from "@/components/SensitiveAmount";
import { SortableContainer, SortableItem } from "@/components/Sortable";
import { SwipeToReveal, SwipeToRevealGroup } from "@/components/SwipeToReveal";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAccounts, useDeleteAccount, type Account } from "@/hooks/useAccounts";
import { useCreateDialog } from "@/hooks/useCreateDialog";
import { useLang } from "@/hooks/useLang";
import { useReorder } from "@/hooks/useReorder";
import { canEditAccount } from "@/lib/accountAccess";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { useTranslations } from "@/lib/i18n/utils";
import { queryKeys } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";

const StarIcon = ({ filled }: { filled?: boolean }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const accountColor = (account: Account) => account.color || "var(--accent)";

/** Row body shared by the list and the drag overlay; `star` is the default-account toggle. */
function AccountRowContent({ account, share, savingsLabel, star }: {
  account: Account;
  /** Fraction (0-1) of the positive total, or null for accounts in the red (no share bar). */
  share: number | null;
  savingsLabel: string;
  star?: React.ReactNode;
}) {
  const balance = Number(account.balance);
  return (
    <>
      <span
        className={cn("lp-icon", account.icon && "lp-icon--contain")}
        style={account.icon ? undefined : { color: accountColor(account), background: `color-mix(in srgb, ${accountColor(account)} 14%, transparent)` }}
      >
        {account.icon ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote logos from arbitrary hosts
          <img src={account.icon} alt="" />
        ) : (
          <CardIcon />
        )}
        {account.name.toLowerCase().includes("remunerada") && (
          <span className="lp-interest" title={savingsLabel}>
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
              <polyline points="17 6 23 6 23 12" />
            </svg>
          </span>
        )}
      </span>
      <span className="lp-main">
        <span className="lp-title">
          <span>{account.name}</span>
          {star}
        </span>
        {share !== null && share > 0 && (
          <span className="lp-meta">
            <span className="lp-share" aria-hidden>
              <span style={{ width: `${Math.max(share * 100, 3)}%`, background: accountColor(account) }} />
            </span>
            <span>{share < 0.01 ? "<1" : Math.round(share * 100)}%</span>
          </span>
        )}
      </span>
      <span className={cn("lp-amount", balance < 0 && "is-negative")}>
        <SensitiveAmount>{formatCurrency(balance)}</SensitiveAmount>
      </span>
    </>
  );
}

export default function AccountsBody() {
  const router = useRouter();
  const lang = useLang();
  const es = lang === "es";
  const t = useTranslations(lang);
  const queryClient = useQueryClient();
  const { data: accounts = [], isLoading } = useAccounts();
  // Joint accounts are shown on their own: they are shared with other people and not part of my total.
  const personal = accounts.filter((account) => !account.is_joint);
  const joint = accounts.filter((account) => account.is_joint);
  const { handleReorder } = useReorder<Account>({ table: "accounts" });
  const deleteAccount = useDeleteAccount();
  const [createOpen, setCreateOpen] = useCreateDialog();
  const [editing, setEditing] = useState<Account | null>(null);
  const [toDelete, setToDelete] = useState<Account | null>(null);

  /** Marks the default account (moved first) used when creating transactions. */
  const setDefault = async (account: Account) => {
    queryClient.setQueryData<Account[]>(queryKeys.accounts.lists(), (old) => old?.map((a) => ({ ...a, is_default: a.id === account.id })));
    handleReorder([account, ...personal.filter((a) => a.id !== account.id)]);
    try {
      await api("/api/accounts/set-default", "POST", { id: account.id });
    } catch {
      await queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
    }
  };

  const header = <CompactPageHeader title={t("accounts.title")} addLabel={t("accounts.add")} onAdd={() => setCreateOpen(true)} />;

  const dialog = (
    <>
      <AccountSheet
        open={createOpen || !!editing}
        onOpenChange={(open) => {
          if (open) return;
          setCreateOpen(false);
          setEditing(null);
        }}
        account={editing}
      />
      <ConfirmDeleteSheet
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={toDelete && (es ? `¿Eliminar «${toDelete.name}»?` : `Delete “${toDelete.name}”?`)}
        description={toDelete && <AccountDeleteWarning accountId={toDelete.id} />}
        confirmLabel={es ? "Sí, eliminar" : "Yes, delete"}
        pending={deleteAccount.isPending}
        onConfirm={async () => {
          if (toDelete) await deleteAccount.mutateAsync(toDelete.id).catch(() => undefined);
          setToDelete(null);
        }}
      />
    </>
  );

  if (isLoading) {
    return (
      <div className="page-container lp-page">
        {header}
        <Bones
          name="accounts"
          loading
          fallback={
            <div className="lp-layout">
              <div className="lp-aside">
                <div className="skeleton" style={{ height: 112, borderRadius: 16 }} />
              </div>
              <div className="lp-content">
                <div className="skeleton" style={{ height: 3 * 57, borderRadius: 16 }} />
              </div>
            </div>
          }
        />
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="page-container lp-page fade-in">
        {header}
        <JointInvites className="lp-section mb-4" />
        <div className="lp-card lp-empty">
          <div className="lp-empty-icon">
            <CardIcon size={24} strokeWidth={2.5} />
          </div>
          <p className="lp-empty-title">{t("accounts.noAccounts")}</p>
          <p className="lp-empty-text">{es ? "Añade tus cuentas bancarias para ver tu patrimonio de un vistazo" : "Add your bank accounts to see your net worth at a glance"}</p>
          <button type="button" className="lp-chip" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" strokeWidth={2.5} />
            {t("accounts.add")}
          </button>
        </div>
        {dialog}
      </div>
    );
  }

  const total = personal.reduce((sum, acc) => sum + Number(acc.balance), 0);
  const positiveTotal = personal.reduce((sum, acc) => sum + Math.max(0, Number(acc.balance)), 0);
  const shareOf = (account: Account) => {
    const balance = Number(account.balance);
    return balance < 0 ? null : positiveTotal > 0 ? balance / positiveTotal : 0;
  };
  const savingsLabel = es ? "Cuenta remunerada" : "Savings account";
  const open = (account: Account) => router.push(`/account/${account.id}`);
  const stop = (action: () => void) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    action();
  };

  return (
    <div className="page-container lp-page fade-in">
      {header}
      <JointInvites className="lp-section mb-4" />

      <Bones name="accounts" loading={false}>
        <div className="lp-layout">
          <aside className="lp-aside">
            <div className="lp-card lp-summary">
              <div className="lp-summary-top">
                <span className="lp-label">{es ? "Saldo total" : "Total balance"}</span>
                <span className="lp-count">
                  {personal.length} {es ? (personal.length === 1 ? "cuenta" : "cuentas") : personal.length === 1 ? "account" : "accounts"}
                </span>
              </div>
              <span className={cn("lp-hero-value", total < 0 && "is-negative")}>
                <SensitiveAmount>{formatCurrency(total)}</SensitiveAmount>
              </span>
              {positiveTotal > 0 && (
                <div className="lp-meter lp-meter--segmented" aria-hidden>
                  {personal
                    .filter((acc) => Number(acc.balance) > 0)
                    .map((acc) => (
                      <span key={acc.id} style={{ width: `${(Number(acc.balance) / positiveTotal) * 100}%`, background: accountColor(acc) }} />
                    ))}
                </div>
              )}
            </div>
          </aside>

          <div className="lp-content">
            <SwipeToRevealGroup>
              <SortableContainer
                items={personal}
                onReorder={handleReorder}
                className="lp-card lp-group lp-group--sortable"
                strategy="vertical"
                renderOverlay={(active) =>
                  active && (
                    <div className="lp-card lp-drag-overlay">
                      <div className="lp-row">
                        <AccountRowContent account={active} share={shareOf(active)} savingsLabel={savingsLabel} />
                      </div>
                    </div>
                  )
                }
                renderItem={(account) => (
                  <SortableItem key={account.id} id={account.id}>
                    <SwipeToReveal
                      id={account.id}
                      className="lp-swipe"
                      desktopMinWidth={1024}
                      actions={
                        <>
                          <button type="button" onClick={stop(() => setEditing(account))} className="lp-action lp-action--edit" aria-label={t("accounts.edit")}>
                            <Pencil className="size-5" />
                          </button>
                          <button type="button" onClick={stop(() => setToDelete(account))} className="lp-action lp-action--danger" aria-label={t("accounts.delete")}>
                            <Trash2 className="size-5" />
                          </button>
                        </>
                      }
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        className="lp-row"
                        onClick={() => open(account)}
                        onKeyDown={(e) => {
                          if (e.target !== e.currentTarget || (e.key !== "Enter" && e.key !== " ")) return;
                          e.preventDefault();
                          open(account);
                        }}
                        aria-label={`${account.name} - ${formatCurrency(Number(account.balance))}`}
                      >
                        <AccountRowContent
                          account={account}
                          share={shareOf(account)}
                          savingsLabel={savingsLabel}
                          star={
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  className={cn("lp-star", account.is_default && "is-default")}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (!account.is_default) setDefault(account);
                                  }}
                                  aria-label={es ? "Marcar como cuenta por defecto" : "Set as default"}
                                  aria-pressed={!!account.is_default}
                                >
                                  <StarIcon filled={!!account.is_default} />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{es ? "Cuenta por defecto para crear transacciones" : "Default account for creating transactions"}</p>
                              </TooltipContent>
                            </Tooltip>
                          }
                        />
                      </div>
                    </SwipeToReveal>
                  </SortableItem>
                )}
              />

              {joint.length > 0 && (
                <section className="lp-section mt-6">
                  <div className="lp-section-head">
                    <span className="lp-section-title">
                      {t("joint.section")}
                      <small>{joint.length}</small>
                    </span>
                  </div>
                  <p className="mb-2 text-sm text-muted-foreground">{t("joint.sectionHint")}</p>
                  <div className="lp-card lp-group">
                    {joint.map((account) => (
                      <SwipeToReveal
                        key={account.id}
                        id={account.id}
                        className="lp-swipe"
                        desktopMinWidth={1024}
                        actions={
                          <>
                            <button type="button" onClick={stop(() => setEditing(account))} className="lp-action lp-action--edit" aria-label={t("accounts.edit")}>
                              <Pencil className="size-5" />
                            </button>
                            {canEditAccount(account.my_role, "delete") && (
                              <button type="button" onClick={stop(() => setToDelete(account))} className="lp-action lp-action--danger" aria-label={t("accounts.delete")}>
                                <Trash2 className="size-5" />
                              </button>
                            )}
                          </>
                        }
                      >
                        <div
                          role="button"
                          tabIndex={0}
                          className="lp-row"
                          onClick={() => open(account)}
                          onKeyDown={(e) => {
                            if (e.target !== e.currentTarget || (e.key !== "Enter" && e.key !== " ")) return;
                            e.preventDefault();
                            open(account);
                          }}
                          aria-label={`${account.name} - ${formatCurrency(Number(account.balance))}`}
                        >
                          <AccountRowContent
                            account={account}
                            share={null}
                            savingsLabel={savingsLabel}
                            star={<span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("joint.badge")}</span>}
                          />
                        </div>
                      </SwipeToReveal>
                    ))}
                  </div>
                </section>
              )}
            </SwipeToRevealGroup>
          </div>
        </div>
      </Bones>

      {dialog}
    </div>
  );
}
