"use client";

import Link from "next/link";
import { useState } from "react";
import { useCreateSubscription } from "@/hooks/useSubscriptionMutations";
import { useAccounts } from "@/hooks/useAccounts";
import { useLang } from "@/hooks/useLang";
import { useTranslations } from "@/lib/i18n/utils";
import { useRouter } from "next/navigation";
import IconPicker from "@/components/IconPicker";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Account {
  id: string;
  name: string;
  color?: string;
}

export default function NewSubscriptionPage() {
  const lang = useLang();
  const t = useTranslations(lang);
  const router = useRouter();
  const createSub = useCreateSubscription();
  const { data: accounts = [] } = useAccounts();
  
  const [icon, setIcon] = useState("");
  const [name, setName] = useState("");
  const [cost, setCost] = useState("");
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [frequency, setFrequency] = useState<"weekly" | "monthly" | "yearly">("monthly");
  const [freqVal, setFreqVal] = useState("1");
  const [accountId, setAccountId] = useState("none");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(cost);
    if (!name || isNaN(num)) return;
    
    await createSub.mutateAsync({
      icon: icon || undefined,
      service_name: name,
      cost: num,
      start_date: startDate.toISOString().slice(0, 10),
      end_date: endDate ? endDate.toISOString().slice(0, 10) : null,
      frequency,
      frequency_value: parseInt(freqVal, 10) || 1,
      account_id: accountId && accountId !== "none" ? accountId : null,
    });
    router.push("/subscriptions");
  };

  const selectedAccount = accountId && accountId !== "none" 
    ? (accounts as Account[]).find((a) => a.id === accountId) 
    : undefined;

  return (
    <div className="page-container fade-in">
      <Link 
        href="/subscriptions" 
        style={{ 
          display: "inline-flex", 
          alignItems: "center", 
          gap: 8, 
          marginBottom: 20, 
          color: "var(--gris-claro)", 
          textDecoration: "none",
          fontSize: "0.9rem",
          fontWeight: 500
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        {t("nav.subscriptions")}
      </Link>

      <h1 className="title" style={{ marginBottom: 24 }}>{t("sub.new")}</h1>

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
            <InputGroup className="!h-10">
              <InputGroupInput
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                required
              />
              <InputGroupAddon align="inline-end">€</InputGroupAddon>
            </InputGroup>
          </div>
          <div className="subs-form-section">
            <Label className="subs-form-label">{t("sub.frequency")}</Label>
            <Select value={frequency} onValueChange={(v) => setFrequency(v as typeof frequency)}>
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
            />
          </div>
        </div>

        {/* Submit */}
        <Button 
          type="submit" 
          className="subs-form-submit" 
          disabled={createSub.isPending}
        >
          {createSub.isPending ? (
            <Spinner className="size-5" />
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          )}
          {t("sub.create")}
        </Button>
      </form>
    </div>
  );
}
