"use client";

import { useState } from "react";
import IconPicker from "@/components/IconPicker";
import {
  AmountField,
  Chips,
  DeleteAction,
  FieldGroup,
  FieldRow,
  FieldStack,
  FormError,
  FormHero,
  HeroTile,
  RowInput,
  SheetButton,
  Swatches,
} from "@/components/SheetFields";
import { Sheet, SheetBody, SheetFooter, SheetForm, useSheetPayload } from "@/components/ui/sheet";
import { parseCurrencyValue } from "@/lib/currency";
import { useCreateAccount, useDeleteAccount, useUpdateAccount, type Account } from "@/hooks/useAccounts";
import { useLang } from "@/hooks/useLang";
import { useTransactions } from "@/hooks/useTransactions";
import { BANK_PROVIDER_LIST, getBankProvider } from "@/lib/bankProviders";
import { useTranslations } from "@/lib/i18n/utils";
import { PALETTE } from "@/lib/palette";

export const CardIcon = ({ size = 20, strokeWidth = 2 }: { size?: number; strokeWidth?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} aria-hidden>
    <rect x="1" y="4" width="22" height="16" rx="2" />
    <line x1="1" y1="10" x2="23" y2="10" />
  </svg>
);

/** "Its N transactions will be deleted too", counted when the confirmation shows up. */
export function AccountDeleteWarning({ accountId }: { accountId: string }) {
  const es = useLang() === "es";
  const { data, isLoading } = useTransactions(undefined, undefined, accountId);
  const count = data?.length ?? 0;
  if (isLoading) return <>{es ? "Contando transacciones…" : "Counting transactions…"}</>;
  if (count === 0) return <>{es ? "La cuenta no tiene transacciones." : "The account has no transactions."}</>;
  return (
    <>
      {es
        ? `También se borrarán sus ${count} transacci${count === 1 ? "ón" : "ones"}. No se puede deshacer.`
        : `Its ${count} transaction${count === 1 ? "" : "s"} will be deleted too. This can't be undone.`}
    </>
  );
}

function AccountFormBody({ account, onDone, onDeleted }: { account: Account | null; onDone: () => void; onDeleted?: () => void }) {
  const lang = useLang();
  const es = lang === "es";
  const t = useTranslations(lang);
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();
  const deleteAccount = useDeleteAccount();
  const [form, setForm] = useState({
    name: account?.name ?? "",
    balance: account ? Number(account.balance).toFixed(2).replace(".", ",") : "",
    icon: account?.icon ?? "",
    color: account?.color ?? PALETTE[0],
    bank_provider: account?.bank_provider ?? "",
  });
  const [error, setError] = useState("");
  const set = (patch: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...patch }));
  const pending = createAccount.isPending || updateAccount.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) {
      setError(es ? "Ponle un nombre a la cuenta" : "Give the account a name");
      return;
    }
    const balance = parseCurrencyValue(form.balance);
    const input = { name, color: form.color, icon: form.icon || undefined, bank_provider: form.bank_provider || null };
    // Only send the balance when it changed: otherwise it would overwrite imports or automations
    // that happened since the form was opened.
    const balanceChanged = !account || Math.round(balance * 100) !== Math.round(Number(account.balance ?? 0) * 100);
    const payload = { ...input, ...(balanceChanged && { balance }) };
    try {
      if (account) await updateAccount.mutateAsync({ id: account.id, ...payload });
      else await createAccount.mutateAsync(payload);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  };

  const bankOptions = [
    { value: "", label: t("accounts.bankProviderNone") },
    ...BANK_PROVIDER_LIST.map((bank) => ({
      value: bank.id,
      label: bank.name,
      // eslint-disable-next-line @next/next/no-img-element -- remote brand logo
      icon: <img src={bank.icon} alt="" />,
    })),
  ];

  return (
    <SheetForm onSubmit={handleSubmit}>
      <SheetBody>
        <FormHero>
          <HeroTile color={form.color} contain={!!form.icon}>
            {/* eslint-disable-next-line @next/next/no-img-element -- remote logos */}
            {form.icon ? <img src={form.icon} alt="" /> : <CardIcon size={30} strokeWidth={1.8} />}
          </HeroTile>
          <AmountField
            id="account-balance"
            label={es ? "Saldo actual" : "Current balance"}
            value={form.balance}
            onChange={(balance) => set({ balance })}
          />
        </FormHero>

        <FieldGroup>
          <FieldRow label={t("settings.name")} htmlFor="account-name">
            <RowInput
              id="account-name"
              placeholder={es ? "Cuenta nómina" : "Main account"}
              value={form.name}
              onChange={(e) => {
                set({ name: e.target.value });
                setError("");
              }}
              enterKeyHint="done"
            />
          </FieldRow>
          <IconPicker value={form.icon} onChange={(icon) => set({ icon })} name={form.name} />
        </FieldGroup>

        <FieldGroup title={t("accounts.bankProvider")} hint={t("accounts.bankProviderTooltip")}>
          <FieldStack>
            <Chips
              scroll
              label={t("accounts.bankProvider")}
              options={bankOptions}
              value={form.bank_provider}
              onChange={(value) => {
                const bank = getBankProvider(value);
                set(bank ? { bank_provider: value, name: form.name || bank.name, icon: form.icon || bank.icon } : { bank_provider: "" });
              }}
            />
          </FieldStack>
        </FieldGroup>

        <FieldGroup title={t("common.color")}>
          <FieldStack>
            <Swatches value={form.color} onChange={(color) => set({ color })} label={t("common.color")} />
          </FieldStack>
        </FieldGroup>

        {account && (
          <FieldGroup>
            <DeleteAction
              label={es ? "Eliminar cuenta" : "Delete account"}
              confirmTitle={es ? `¿Eliminar «${account.name}»?` : `Delete “${account.name}”?`}
              confirmText={<AccountDeleteWarning accountId={account.id} />}
              confirmLabel={es ? "Sí, eliminar" : "Yes, delete"}
              pending={deleteAccount.isPending}
              onConfirm={async () => {
                await deleteAccount.mutateAsync(account.id);
                onDone();
                onDeleted?.();
              }}
            />
          </FieldGroup>
        )}
      </SheetBody>

      <SheetFooter>
        <FormError>{error}</FormError>
        <SheetButton type="submit" pending={pending}>
          {account ? (es ? "Guardar cambios" : "Save changes") : es ? "Crear cuenta" : "Create account"}
        </SheetButton>
      </SheetFooter>
    </SheetForm>
  );
}

/** Create (no `account`) or edit / delete an account. */
export function AccountSheet({ open, onOpenChange, account, onDeleted }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: Account | null;
  /** After deleting (e.g. leave the account's page). */
  onDeleted?: () => void;
}) {
  const t = useTranslations(useLang());
  const shown = useSheetPayload(open, account ?? null);
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={shown ? t("accounts.edit") : t("accounts.add")}>
      <AccountFormBody account={shown} onDone={() => onOpenChange(false)} onDeleted={onDeleted} />
    </Sheet>
  );
}
