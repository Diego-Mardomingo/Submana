"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AccountSelect } from "@/components/AccountSelect";
import { BackButton } from "@/components/BackButton";
import IconPicker from "@/components/IconPicker";
import { CurrencyInput, parseCurrencyValue } from "@/components/ui/currency-input";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { useLang } from "@/hooks/useLang";
import { useCreateSubscription, useUpdateSubscription, type Subscription } from "@/hooks/useSubscriptions";
import { parseDateString, toDateString } from "@/lib/date";
import { useTranslations } from "@/lib/i18n/utils";

/** Create (no `sub`) or edit subscription page. */
export default function SubscriptionForm({ sub }: { sub?: Subscription }) {
  const lang = useLang();
  const t = useTranslations(lang);
  const router = useRouter();
  const createSub = useCreateSubscription();
  const updateSub = useUpdateSubscription();

  const [icon, setIcon] = useState(sub?.icon || "");
  const [name, setName] = useState(sub?.service_name ?? "");
  const [cost, setCost] = useState(sub ? Number(sub.cost).toFixed(2).replace(".", ",") : "");
  const [startDate, setStartDate] = useState(() => (sub?.start_date ? parseDateString(sub.start_date) : new Date()));
  const [endDate, setEndDate] = useState(() => (sub?.end_date ? parseDateString(sub.end_date) : undefined));
  const [frequency, setFrequency] = useState<Subscription["frequency"]>(sub?.frequency ?? "monthly");
  const [freqVal, setFreqVal] = useState(String(sub?.frequency_value || 1));
  const [accountId, setAccountId] = useState(sub?.account_id ?? "");
  const datePlaceholder = lang === "es" ? "Seleccionar fecha" : "Select date";
  const noAccount = lang === "es" ? "Sin cuenta" : "No account";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseCurrencyValue(cost);
    if (!name || amount <= 0) return;
    const input = {
      icon: icon || undefined,
      service_name: name,
      cost: amount,
      start_date: toDateString(startDate),
      end_date: endDate ? toDateString(endDate) : null,
      frequency,
      frequency_value: parseInt(freqVal, 10) || 1,
      account_id: accountId || null,
    };
    if (sub) {
      await updateSub.mutateAsync({ id: sub.id, ...input });
      router.push(`/subscription/${sub.id}`);
    } else {
      await createSub.mutateAsync(input);
      router.push("/subscriptions");
    }
  };

  return (
    <div className="page-container fade-in">
      <BackButton label={sub?.service_name} />
      <h1 className="title" style={{ marginBottom: 24 }}>
        {t(sub ? "sub.edit" : "sub.new")}
      </h1>

      <form onSubmit={handleSubmit} className="subs-form">
        <div className="subs-form-section">
          <Label className="subs-form-label" optional>
            {t("sub.icon")}
          </Label>
          <IconPicker value={icon} onChange={setIcon} />
        </div>

        <div className="subs-form-section">
          <Label className="subs-form-label" required>
            {t("sub.name")}
          </Label>
          <Input type="text" placeholder={t("sub.namePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} required className="!h-10" />
        </div>

        <div className="subs-form-section">
          <Label className="subs-form-label" optional>
            {t("sub.account")}
          </Label>
          <AccountSelect value={accountId} onChange={setAccountId} placeholder={noAccount} noneLabel={noAccount} />
        </div>

        <div className="subs-form-row triple">
          <div className="subs-form-section">
            <Label className="subs-form-label" required>
              {t("sub.cost")}
            </Label>
            <CurrencyInput placeholder="0,00" value={cost} onChange={setCost} className="!h-10" />
          </div>
          <div className="subs-form-section">
            <Label className="subs-form-label">{t("sub.frequency")}</Label>
            <Select value={frequency} onValueChange={(v) => setFrequency(v as Subscription["frequency"])}>
              <SelectTrigger className="w-full !h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["weekly", "monthly", "yearly"] as const).map((f) => (
                  <SelectItem key={f} value={f}>
                    {t(`sub.${f}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="subs-form-section">
            <Label className="subs-form-label">{t("sub.every")}</Label>
            <Input type="number" min="1" value={freqVal} onChange={(e) => setFreqVal(e.target.value)} className="!h-10" />
          </div>
        </div>

        <div className="subs-form-row">
          <div className="subs-form-section">
            <Label className="subs-form-label" required>
              {t("sub.startDate")}
            </Label>
            <DatePicker value={startDate} onChange={(date) => date && setStartDate(date)} placeholder={datePlaceholder} lang={lang} />
          </div>
          <div className="subs-form-section">
            <Label className="subs-form-label" optional>
              {t("sub.endDate")}
            </Label>
            <DatePicker value={endDate} onChange={setEndDate} placeholder={datePlaceholder} lang={lang} clearable />
          </div>
        </div>

        <SubmitButton pending={createSub.isPending || updateSub.isPending} isEdit={!!sub}>
          {t(sub ? "sub.saveChanges" : "sub.create")}
        </SubmitButton>
      </form>
    </div>
  );
}
