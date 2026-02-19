"use client";

import Link from "next/link";
import { useState } from "react";
import { useCreateSubscription } from "@/hooks/useSubscriptionMutations";
import { useLang } from "@/hooks/useLang";
import { useTranslations } from "@/lib/i18n/utils";
import { useRouter } from "next/navigation";

export default function NewSubscriptionPage() {
  const t = useTranslations(useLang());
  const router = useRouter();
  const createSub = useCreateSubscription();
  const [name, setName] = useState("");
  const [cost, setCost] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState("");
  const [frequency, setFrequency] = useState<"weekly" | "monthly" | "yearly">("monthly");
  const [freqVal, setFreqVal] = useState("1");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(cost);
    if (!name || isNaN(num)) return;
    await createSub.mutateAsync({
      service_name: name,
      cost: num,
      start_date: startDate,
      end_date: endDate || null,
      frequency,
      frequency_value: parseInt(freqVal, 10) || 1,
    });
    router.push("/subscriptions");
  };

  return (
    <div className="page-container">
      <Link href="/subscriptions" style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 24, color: "var(--gris-claro)", textDecoration: "none" }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6" /></svg>
        {t("nav.subscriptions")}
      </Link>
      <h1 style={{ marginBottom: 24 }}>{t("sub.new")}</h1>
      <form onSubmit={handleSubmit} style={{ background: "var(--gris-oscuro)", border: "1px solid var(--gris)", borderRadius: 16, padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <div className="field">
          <label>{t("sub.name")}</label>
          <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder={t("sub.namePlaceholder")} />
        </div>
        <div className="field">
          <label>{t("sub.cost")} (€)</label>
          <input type="number" step="0.01" min="0" required value={cost} onChange={(e) => setCost(e.target.value)} />
        </div>
        <div className="field">
          <label>{t("sub.startDate")}</label>
          <input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="field">
          <label>{t("sub.endDate")} ({t("sub.optional")})</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <div className="field">
          <label>{t("sub.frequency")}</label>
          <select value={frequency} onChange={(e) => setFrequency(e.target.value as "weekly" | "monthly" | "yearly")}>
            <option value="weekly">{t("sub.weekly")}</option>
            <option value="monthly">{t("sub.monthly")}</option>
            <option value="yearly">{t("sub.yearly")}</option>
          </select>
        </div>
        <div className="field">
          <label>{t("sub.every")} (value)</label>
          <input type="number" min="1" value={freqVal} onChange={(e) => setFreqVal(e.target.value)} />
        </div>
        <button type="submit" className="btn-save" disabled={createSub.isPending}>{t("sub.create")}</button>
      </form>
    </div>
  );
}
