"use client";

import { useState } from "react";
import { useUpdateAccount } from "@/hooks/useAccountMutations";
import { useLang } from "@/hooks/useLang";
import { useTranslations } from "@/lib/i18n/utils";
import { useRouter } from "next/navigation";
import IconPicker from "@/components/IconPicker";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

  return (
    <>
      <h1 className="title" style={{ marginBottom: 24 }}>
        {t("accounts.edit")}
      </h1>

      <form onSubmit={handleSubmit} className="subs-form">
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
          <Select value={bankProvider || "none"} onValueChange={handleBankProviderChange}>
            <SelectTrigger className="!h-10">
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

        <div className="subs-form-section">
          <Label className="subs-form-label" optional>{t("sub.icon")}</Label>
          <IconPicker defaultIcon={icon} onIconSelect={setIcon} />
        </div>

        <div className="subs-form-section">
          <Label className="subs-form-label" required>{t("settings.name")}</Label>
          <Input
            type="text"
            placeholder="Ex. Main Bank"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="!h-10"
          />
        </div>

        <div className="subs-form-row">
          <div className="subs-form-section">
            <Label className="subs-form-label" required>{t("accounts.balance")}</Label>
            <CurrencyInput
              placeholder="0,00"
              value={balance}
              onChange={setBalance}
              className="!h-10"
            />
          </div>
          <div className="subs-form-section">
            <Label className="subs-form-label">{t("common.color")}</Label>
            <Popover open={colorPickerOpen} onOpenChange={setColorPickerOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="subs-form-color-btn"
                  style={{ backgroundColor: color }}
                />
              </PopoverTrigger>
              <PopoverContent className="w-auto p-3" align="start">
                <div className="grid grid-cols-3 gap-2">
                  {colors.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className="size-7 rounded-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
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
        </div>

        <Button
          type="submit"
          className="subs-form-submit"
          disabled={updateAccount.isPending}
        >
          {updateAccount.isPending ? (
            <Spinner className="size-5" />
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
          )}
          {t("common.save")}
        </Button>
      </form>
    </>
  );
}
