"use client";

import { useState, type RefObject } from "react";
import { ColorPicker, PALETTE } from "@/components/ColorPicker";
import IconPicker from "@/components/IconPicker";
import { Button } from "@/components/ui/button";
import { CurrencyInput, parseCurrencyValue } from "@/components/ui/currency-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { useCreateAccount, useUpdateAccount, type Account } from "@/hooks/useAccounts";
import { useLang } from "@/hooks/useLang";
import { BANK_PROVIDER_LIST, getBankProvider } from "@/lib/bankProviders";
import { useTranslations } from "@/lib/i18n/utils";

const BankOption = ({ id }: { id: string }) => {
  const bank = getBankProvider(id);
  return (
    <div className="flex items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element -- remote brand logo */}
      <img src={bank?.icon} alt="" className="size-5 rounded" />
      <span>{bank?.name}</span>
    </div>
  );
};

/**
 * Create (no `account`) or edit account form. `selectOpenRef` reports whether the bank select is
 * open: on Android a Dialog receives the "outside" click after the select closes, so the parent
 * dialog uses it to ignore that click.
 */
export function AccountForm({ account, onDone, onCancel, selectOpenRef }: {
  account?: Account;
  onDone: () => void;
  onCancel: () => void;
  selectOpenRef?: RefObject<boolean>;
}) {
  const lang = useLang();
  const t = useTranslations(lang);
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();
  const [form, setForm] = useState({
    name: account?.name ?? "",
    balance: account ? Number(account.balance).toFixed(2).replace(".", ",") : "",
    icon: account?.icon ?? "",
    color: account?.color ?? PALETTE[0],
    bank_provider: account?.bank_provider ?? "",
  });
  const set = (patch: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...patch }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) return;
    const input = { ...form, balance: parseCurrencyValue(form.balance), icon: form.icon || undefined, bank_provider: form.bank_provider || null };
    if (account) await updateAccount.mutateAsync({ id: account.id, ...input });
    else await createAccount.mutateAsync(input);
    onDone();
  };

  const onSelectOpenChange = (open: boolean) => {
    if (!selectOpenRef) return;
    if (open) selectOpenRef.current = true;
    else setTimeout(() => (selectOpenRef.current = false), 150);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Label className="subs-form-label">{t("accounts.bankProvider")}</Label>
        <p className="text-xs text-muted-foreground max-w-[200px] -mt-1">{t("accounts.bankProviderTooltip")}</p>
        <Select
          onOpenChange={onSelectOpenChange}
          value={form.bank_provider || "none"}
          onValueChange={(value) => {
            const bank = getBankProvider(value);
            set(bank ? { bank_provider: value, name: form.name || bank.name, icon: form.icon || bank.icon } : { bank_provider: "" });
          }}
        >
          <SelectTrigger className="h-10">
            <SelectValue placeholder={t("accounts.bankProviderNone")}>
              {form.bank_provider ? <BankOption id={form.bank_provider} /> : t("accounts.bankProviderNone")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t("accounts.bankProviderNone")}</SelectItem>
            {BANK_PROVIDER_LIST.map((bank) => (
              <SelectItem key={bank.id} value={bank.id}>
                <BankOption id={bank.id} />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label className="subs-form-label" optional>
          {t("sub.icon")}
        </Label>
        <IconPicker value={form.icon} onChange={(icon) => set({ icon })} />
      </div>

      <div className="flex flex-col gap-2">
        <Label className="subs-form-label" htmlFor="acc-name" required>
          {t("settings.name")}
        </Label>
        <Input id="acc-name" type="text" required placeholder="Santander" value={form.name} onChange={(e) => set({ name: e.target.value })} className="h-10" />
      </div>

      <div className="flex flex-col gap-2">
        <Label className="subs-form-label" htmlFor="acc-balance" optional>
          {t("accounts.balance")}
        </Label>
        <CurrencyInput id="acc-balance" placeholder="0,00" value={form.balance} onChange={(balance) => set({ balance })} className="h-10" />
      </div>

      <div className="flex flex-col gap-2">
        <Label className="subs-form-label">{t("common.color")}</Label>
        <ColorPicker value={form.color} onChange={(color) => set({ color })} />
      </div>

      <div className="flex justify-center gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <SubmitButton pending={createAccount.isPending || updateAccount.isPending} isEdit={!!account} className="gap-2">
          {account ? t("common.save") : lang === "es" ? "Crear" : "Create"}
        </SubmitButton>
      </div>
    </form>
  );
}
