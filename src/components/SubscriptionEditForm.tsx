"use client";

import { useState } from "react";
import { useUpdateSubscription } from "@/hooks/useSubscriptionMutations";
import { useAccounts } from "@/hooks/useAccounts";
import { useLang } from "@/hooks/useLang";
import { useTranslations } from "@/lib/i18n/utils";
import { parseDateString, toDateString } from "@/lib/date";
import { useRouter } from "next/navigation";
import IconPicker from "@/components/IconPicker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { DatePicker } from "@/components/ui/date-picker";
import { CurrencyInput, parseCurrencyValue } from "@/components/ui/currency-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BackButton } from "@/components/BackButton";

interface Account {
  id: string;
  name: string;
  color?: string;
}

interface Sub {
  id: string;
  service_name: string;
  icon?: string;
  cost: number;
  start_date: string;
  end_date?: string | null;
  frequency: string;
  frequency_value: number;
  account_id?: string | null;
}

export default function SubscriptionEditForm({ sub }: { sub: Sub }) {
  const lang = useLang();
  const t = useTranslations(lang);
  const router = useRouter();
  const updateSub = useUpdateSubscription();
  const { data: accounts = [] } = useAccounts();
  
  const [icon, setIcon] = useState(sub.icon || "");
  const [name, setName] = useState(sub.service_name);
  const [cost, setCost] = useState(
    sub.cost !== undefined && sub.cost !== null
      ? sub.cost.toFixed(2).replace(".", ",")
      : ""
  );
  const [startDate, setStartDate] = useState<Date>(
    sub.start_date ? parseDateString(sub.start_date) : new Date()
  );
  const [endDate, setEndDate] = useState<Date | undefined>(
    sub.end_date ? parseDateString(sub.end_date) : undefined
  );
  const [frequency, setFrequency] = useState(sub.frequency);
  const [freqVal, setFreqVal] = useState(String(sub.frequency_value || 1));
  const [accountId, setAccountId] = useState(sub.account_id || "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseCurrencyValue(cost);
    if (!name || num <= 0) return;
    
    await updateSub.mutateAsync({
      id: sub.id,
      icon: icon || undefined,
      service_name: name,
      cost: num,
      start_date: toDateString(startDate),
      end_date: endDate ? toDateString(endDate) : null,
      frequency,
      frequency_value: parseInt(freqVal, 10) || 1,
      account_id: accountId && accountId !== "none" ? accountId : null,
    });
    router.push(`/subscription/${sub.id}`);
  };

  const selectedAccount = accountId && accountId !== "none" 
    ? (accounts as Account[]).find((a) => a.id === accountId) 
    : undefined;

  return (
    <div className="page-container fade-in">
      <BackButton label={sub.service_name} />

      <h1 className="title" style={{ marginBottom: 24 }}>{t("sub.edit")}</h1>

      <form onSubmit={handleSubmit} className="subs-form">
        {/* Icon Picker */}
        <div className="subs-form-section">
          <Label className="subs-form-label" optional>{t("sub.icon")}</Label>
          <IconPicker defaultIcon={icon} onIconSelect={setIcon} />
        </div>

        {/* Name */}
        <div className="subs-form-section">
          <Label className="subs-form-label" required>{t("sub.name")}</Label>
          <Input
            type="text"
            placeholder={t("sub.namePlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="!h-10"
          />
        </div>

        {/* Account */}
        <div className="subs-form-section">
          <Label className="subs-form-label" optional>{t("sub.account")}</Label>
          <Select value={accountId || "none"} onValueChange={setAccountId}>
            <SelectTrigger className="w-full !h-10">
              <SelectValue placeholder={lang === "es" ? "Sin cuenta" : "No account"}>
                {selectedAccount ? (
                  <span className="flex items-center gap-2">
                    <span
                      className="size-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: selectedAccount.color || "var(--accent)" }}
                    />
                    {selectedAccount.name}
                  </span>
                ) : (
                  lang === "es" ? "Sin cuenta" : "No account"
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">
                {lang === "es" ? "Sin cuenta" : "No account"}
              </SelectItem>
              {(accounts as Account[]).map((acc) => (
                <SelectItem key={acc.id} value={acc.id}>
                  <span className="flex items-center gap-2">
                    <span
                      className="size-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: acc.color || "var(--accent)" }}
                    />
                    {acc.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Cost + Frequency */}
        <div className="subs-form-row triple">
          <div className="subs-form-section">
            <Label className="subs-form-label" required>{t("sub.cost")}</Label>
            <CurrencyInput
              placeholder="0,00"
              value={cost}
              onChange={setCost}
              className="!h-10"
            />
          </div>
          <div className="subs-form-section">
            <Label className="subs-form-label">{t("sub.frequency")}</Label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger className="w-full !h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">{t("sub.weekly")}</SelectItem>
                <SelectItem value="monthly">{t("sub.monthly")}</SelectItem>
                <SelectItem value="yearly">{t("sub.yearly")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="subs-form-section">
            <Label className="subs-form-label">{t("sub.every")}</Label>
            <Input
              type="number"
              min="1"
              value={freqVal}
              onChange={(e) => setFreqVal(e.target.value)}
              className="!h-10"
            />
          </div>
        </div>

        {/* Dates */}
        <div className="subs-form-row">
          <div className="subs-form-section">
            <Label className="subs-form-label" required>{t("sub.startDate")}</Label>
            <DatePicker
              value={startDate}
              onChange={(date) => date && setStartDate(date)}
              placeholder={lang === "es" ? "Seleccionar fecha" : "Select date"}
              lang={lang}
            />
          </div>
          <div className="subs-form-section">
            <Label className="subs-form-label" optional>{t("sub.endDate")}</Label>
            <DatePicker
              value={endDate}
              onChange={setEndDate}
              placeholder={lang === "es" ? "Seleccionar fecha" : "Select date"}
              lang={lang}
              clearable
            />
          </div>
        </div>

        {/* Submit */}
        <SubmitButton pending={updateSub.isPending} isEdit>
          {t("sub.saveChanges")}
        </SubmitButton>
      </form>
    </div>
  );
}
