"use client";

import { useState } from "react";
import { useUpdateAccount } from "@/hooks/useAccountMutations";
import { useLang } from "@/hooks/useLang";
import { useTranslations } from "@/lib/i18n/utils";
import { useRouter } from "next/navigation";
import IconPicker from "@/components/IconPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { CurrencyInput, parseCurrencyValue } from "@/components/ui/currency-input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ACCOUNT_BUDGET_COLORS, defaultAccountBudgetColor } from "@/lib/accountBudgetColors";
import { BANK_PROVIDER_LIST, getBankProvider } from "@/lib/bankProviders";

interface Account {
  id: string;
  name: string;
  balance: number;
  icon?: string;
  color?: string;
  bank_provider?: string | null;
}

const colors = ACCOUNT_BUDGET_COLORS;

export default function AccountEditForm({ account }: { account: Account }) {
  const lang = useLang();
  const t = useTranslations(lang);
  const router = useRouter();
  const updateAccount = useUpdateAccount();

  const [icon, setIcon] = useState(account.icon || "");
  const [name, setName] = useState(account.name);
  const [balance, setBalance] = useState(
    account.balance !== undefined && account.balance !== null
      ? account.balance.toFixed(2).replace(".", ",")
      : ""
  );
  const [color, setColor] = useState(account.color || defaultAccountBudgetColor);
  const [bankProvider, setBankProvider] = useState(account.bank_provider || "");
  const [colorPickerOpen, setColorPickerOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const balanceNum = parseCurrencyValue(balance);
    if (!name) return;

    await updateAccount.mutateAsync({
      id: account.id,
      name,
      balance: balanceNum,
      icon: icon || undefined,
      color,
      bank_provider: bankProvider || null,
    });
    router.push(`/account/${account.id}`);
  };

  const handleBankProviderChange = (value: string) => {
    if (value === "none") {
      setBankProvider("");
    } else {
      const bank = getBankProvider(value);
      if (bank) {
        setBankProvider(value);
        if (!name) setName(bank.name);
        if (!icon) setIcon(bank.icon);
      }
    }
  };

  const handleCancel = () => router.push(`/account/${account.id}`);

  return (
    <>
      <h1 className="title" style={{ marginBottom: 24 }}>
        {t("accounts.edit")}
      </h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Label className="subs-form-label">{t("accounts.bankProvider")}</Label>
          <p className="text-xs text-muted-foreground max-w-[200px] -mt-1">
            {t("accounts.bankProviderTooltip")}
          </p>
          <Select value={bankProvider || "none"} onValueChange={handleBankProviderChange}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder={t("accounts.bankProviderNone")}>
                {bankProvider ? (
                  <div className="flex items-center gap-2">
                    <img
                      src={getBankProvider(bankProvider)?.icon}
                      alt=""
                      className="size-5 rounded"
                    />
                    <span>{getBankProvider(bankProvider)?.name}</span>
                  </div>
                ) : (
                  t("accounts.bankProviderNone")
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
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

        <div className="flex flex-col gap-2">
          <Label className="subs-form-label" optional>{t("sub.icon")}</Label>
          <IconPicker defaultIcon={icon} onIconSelect={setIcon} />
        </div>

        <div className="flex flex-col gap-2">
          <Label className="subs-form-label" htmlFor="acc-name" required>{t("settings.name")}</Label>
          <Input
            id="acc-name"
            type="text"
            required
            placeholder="Santander"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-10"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label className="subs-form-label" htmlFor="acc-balance" optional>{t("accounts.balance")}</Label>
          <CurrencyInput
            id="acc-balance"
            placeholder="0,00"
            value={balance}
            onChange={setBalance}
            className="h-10"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label className="subs-form-label">{t("common.color")}</Label>
          <Popover open={colorPickerOpen} onOpenChange={setColorPickerOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="size-10 rounded-lg cursor-pointer border border-input"
                style={{ backgroundColor: color }}
              />
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3" align="start" side="top">
              <div className="grid grid-cols-4 gap-2">
                {colors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="size-6 rounded-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    style={{
                      backgroundColor: c,
                      border: color === c ? "2px solid var(--blanco)" : "none",
                    }}
                    onClick={() => {
                      setColor(c);
                      setColorPickerOpen(false);
                    }}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex justify-center gap-3 sm:justify-center">
          <Button type="button" variant="outline" onClick={handleCancel}>
            {t("common.cancel")}
          </Button>
          <SubmitButton pending={updateAccount.isPending} isEdit className="gap-2">
            {t("common.save")}
          </SubmitButton>
        </div>
      </form>
    </>
  );
}
