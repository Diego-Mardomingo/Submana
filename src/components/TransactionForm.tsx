"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAccounts } from "@/hooks/useAccounts";
import { useCategories } from "@/hooks/useCategories";
import { useCreateTransaction } from "@/hooks/useCreateTransaction";
import { useUpdateTransaction } from "@/hooks/useUpdateTransaction";
import { useLang } from "@/hooks/useLang";
import { useTranslations } from "@/lib/i18n/utils";

type CategoryWithSubs = { id: string; name: string; subcategories?: Array<{ id: string; name: string }> };

interface TransactionFormProps {
  editData?: {
    id: string;
    amount: number;
    type: string;
    date: string;
    description?: string;
    account_id?: string;
    category_id?: string;
    subcategory_id?: string;
  };
}

export default function TransactionForm({ editData }: TransactionFormProps) {
  const lang = useLang();
  const t = useTranslations(lang);
  const router = useRouter();
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const createTx = useCreateTransaction();
  const updateTx = useUpdateTransaction();

  const parents = (categories as CategoryWithSubs[]).filter((c) => !("parent_id" in c) || !(c as { parent_id?: string }).parent_id);
  const allCategories = (categories as CategoryWithSubs[]).flatMap((c) =>
    c.subcategories ? [c, ...c.subcategories] : [c]
  );

  const [type, setType] = useState<"income" | "expense">(editData?.type === "income" ? "income" : "expense");
  const [amount, setAmount] = useState(editData ? String(editData.amount) : "");
  const [date, setDate] = useState(editData?.date?.slice(0, 10) || new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState(editData?.description || "");
  const [accountId, setAccountId] = useState(editData?.account_id || "");
  const [categoryId, setCategoryId] = useState(editData?.category_id || "");
  const [subcategoryId, setSubcategoryId] = useState(editData?.subcategory_id || "");
  const [error, setError] = useState("");

  useEffect(() => {
    const def = (accounts as Array<{ id: string; is_default?: boolean }>).find((a) => a.is_default);
    if (!editData && !accountId && def) setAccountId(def.id);
  }, [accounts, accountId, editData]);

  const subcategories = (categories as CategoryWithSubs[]).find((c) => c.id === categoryId)?.subcategories || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0 || !date) {
      setError("Please fill all required fields");
      return;
    }
    const payload = {
      amount: num,
      type,
      date,
      description: description || undefined,
      account_id: accountId || undefined,
      category_id: categoryId || undefined,
      subcategory_id: subcategoryId || undefined,
    };
    try {
      if (editData) {
        await updateTx.mutateAsync({ id: editData.id, ...payload });
      } else {
        await createTx.mutateAsync(payload);
      }
      router.push("/transactions");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    }
  };

  const pending = createTx.isPending || updateTx.isPending;

  return (
    <div className="page-container">
      <nav style={{ marginBottom: "2rem" }}>
        <Link href="/transactions" style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--gris-claro)", textDecoration: "none" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          {t("nav.transactions")}
        </Link>
      </nav>
      <h1 style={{ marginBottom: "1.5rem", fontSize: "1.75rem", fontWeight: 800 }}>
        {editData ? t("transactions.edit") : t("transactions.add")}
      </h1>
      {error && (
        <div style={{ background: "rgba(255,68,68,0.1)", border: "1px solid rgba(255,68,68,0.2)", color: "#ff4444", padding: 12, borderRadius: 12, marginBottom: 16 }}>
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} style={{ background: "var(--gris-oscuro)", border: "1px solid var(--gris)", borderRadius: 16, padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, background: "var(--gris)", padding: 4, borderRadius: 14 }}>
          <label style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 12, borderRadius: 12, background: type === "expense" ? "var(--danger)" : "transparent", color: type === "expense" ? "white" : "var(--gris-claro)" }}>
            <input type="radio" name="type" value="expense" checked={type === "expense"} onChange={() => setType("expense")} style={{ display: "none" }} />
            {t("transactions.expense")}
          </label>
          <label style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 12, borderRadius: 12, background: type === "income" ? "var(--success)" : "transparent", color: type === "income" ? "white" : "var(--gris-claro)" }}>
            <input type="radio" name="type" value="income" checked={type === "income"} onChange={() => setType("income")} style={{ display: "none" }} />
            {t("transactions.income")}
          </label>
        </div>
        <div className="field">
          <label>{t("common.amount")} (€)</label>
          <input type="number" step="0.01" min="0" required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
        </div>
        <div className="field">
          <label>{t("common.date")}</label>
          <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="field">
          <label>{t("common.description")}</label>
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Lunch, Salary, etc." />
        </div>
        <div className="field">
          <label>{t("common.account")}</label>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">—</option>
            {(accounts as Array<{ id: string; name: string }>).map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>{t("common.category")}</label>
          <select value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setSubcategoryId(""); }}>
            <option value="">—</option>
            {parents.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        {subcategories.length > 0 && (
          <div className="field">
            <label>Subcategory</label>
            <select value={subcategoryId} onChange={(e) => setSubcategoryId(e.target.value)}>
              <option value="">—</option>
              {subcategories.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}
        <button type="submit" className="btn-save" disabled={pending} style={{ width: "100%", padding: 16 }}>
          {editData ? t("common.save") : t("transactions.add")}
        </button>
      </form>
    </div>
  );
}
