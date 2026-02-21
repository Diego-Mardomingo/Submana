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
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState("");
  const [frequency, setFrequency] = useState<"weekly" | "monthly" | "yearly">("monthly");
  const [freqVal, setFreqVal] = useState("1");
  const [accountId, setAccountId] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(cost);
    if (!name || isNaN(num)) return;
    
    await createSub.mutateAsync({
      icon: icon || undefined,
      service_name: name,
      cost: num,
      start_date: startDate,
      end_date: endDate || null,
      frequency,
      frequency_value: parseInt(freqVal, 10) || 1,
      account_id: accountId || null,
    });
    router.push("/subscriptions");
  };

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
          <label className="subs-form-label">{t("sub.icon")}</label>
          <IconPicker defaultIcon={icon} onIconSelect={setIcon} />
        </div>

        {/* Name */}
        <div className="subs-form-section">
          <label className="subs-form-label">{t("sub.name")}</label>
          <input
            type="text"
            className="subs-form-input"
            placeholder={t("sub.namePlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        {/* Account */}
        <div className="subs-form-section">
          <label className="subs-form-label">
            {t("sub.account")} <span style={{ opacity: 0.6 }}>({t("sub.optional")})</span>
          </label>
          <div className="subs-form-select-wrapper">
            <select
              className="subs-form-select"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              <option value="">{lang === "es" ? "Sin cuenta" : "No account"}</option>
              {(accounts as Account[]).map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>
            {accountId && (
              <span
                className="subs-form-account-indicator"
                style={{
                  backgroundColor: (accounts as Account[]).find((a) => a.id === accountId)?.color || "var(--accent)",
                }}
              />
            )}
          </div>
        </div>

        {/* Cost + Frequency */}
        <div className="subs-form-row triple">
          <div className="subs-form-section">
            <label className="subs-form-label">{t("sub.cost")}</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="subs-form-input"
              placeholder="0.00"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              required
            />
          </div>
          <div className="subs-form-section">
            <label className="subs-form-label">{t("sub.frequency")}</label>
            <select
              className="subs-form-select"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as "weekly" | "monthly" | "yearly")}
            >
              <option value="weekly">{t("sub.weekly")}</option>
              <option value="monthly">{t("sub.monthly")}</option>
              <option value="yearly">{t("sub.yearly")}</option>
            </select>
          </div>
          <div className="subs-form-section">
            <label className="subs-form-label">{t("sub.every")}</label>
            <input
              type="number"
              min="1"
              className="subs-form-input"
              value={freqVal}
              onChange={(e) => setFreqVal(e.target.value)}
            />
          </div>
        </div>

        {/* Dates */}
        <div className="subs-form-row">
          <div className="subs-form-section">
            <label className="subs-form-label">{t("sub.startDate")}</label>
            <input
              type="date"
              className="subs-form-input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>
          <div className="subs-form-section">
            <label className="subs-form-label">
              {t("sub.endDate")} <span style={{ opacity: 0.6 }}>({t("sub.optional")})</span>
            </label>
            <input
              type="date"
              className="subs-form-input"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        {/* Submit */}
        <button 
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
        </button>
      </form>
    </div>
  );
}
