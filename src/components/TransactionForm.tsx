"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AccountSelect } from "@/components/AccountSelect";
import { BackButton } from "@/components/BackButton";
import { CurrencyInput, parseCurrencyValue } from "@/components/ui/currency-input";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { useAccounts } from "@/hooks/useAccounts";
import { useCategories, type CategoryItem } from "@/hooks/useCategories";
import { useLang } from "@/hooks/useLang";
import { useCreateTransaction, useUpdateTransaction, type Transaction } from "@/hooks/useTransactions";
import { parseDateString, toDateString } from "@/lib/date";
import { useTranslations } from "@/lib/i18n/utils";
import { safeInternalPath } from "@/lib/navigation";

function CategorySelect({ value, onChange, options }: { value: string; onChange: (id: string) => void; options: CategoryItem[] }) {
  return (
    <Select value={value || "none"} onValueChange={(v) => onChange(v === "none" ? "" : v)}>
      <SelectTrigger className="w-full !h-10">
        <SelectValue placeholder="—" />
      </SelectTrigger>
      <SelectContent position="popper" side="top">
        <SelectItem value="none">—</SelectItem>
        {options.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            <span className="flex items-center gap-2">
              {c.emoji && <span>{c.emoji}</span>}
              {c.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Create (no `transaction`) or edit transaction page. */
export default function TransactionForm({ transaction, returnTo }: { transaction?: Transaction; returnTo?: string }) {
  const lang = useLang();
  const t = useTranslations(lang);
  const router = useRouter();
  const { data: accounts = [] } = useAccounts();
  const { data: categoriesData } = useCategories();
  const createTx = useCreateTransaction();
  const updateTx = useUpdateTransaction();

  const [type, setType] = useState<"income" | "expense">(transaction?.type ?? "expense");
  const [amount, setAmount] = useState(transaction ? Number(transaction.amount).toFixed(2).replace(".", ",") : "");
  const [date, setDate] = useState(() => (transaction ? parseDateString(transaction.date) : new Date()));
  const [description, setDescription] = useState(transaction?.description ?? "");
  const [pickedAccountId, setAccountId] = useState(transaction?.account_id ?? "");
  const [categoryId, setCategoryId] = useState(transaction?.category_id ?? "");
  const [subcategoryId, setSubcategoryId] = useState(transaction?.subcategory_id ?? "");
  const [error, setError] = useState("");

  // New transactions default to the account marked as default.
  const accountId = pickedAccountId || (transaction ? "" : (accounts.find((a) => a.is_default)?.id ?? ""));
  const categories = [...(categoriesData?.userCategories ?? []), ...(categoriesData?.defaultCategories ?? [])];
  const parents = categories.filter((c) => !c.parent_id);
  const category = parents.find((c) => c.id === categoryId);
  const subcategories = category?.subcategories ?? [];
  const excludedFromMetrics = category?.exclude_from_metrics || subcategories.find((s) => s.id === subcategoryId)?.exclude_from_metrics;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const num = parseCurrencyValue(amount);
    if (num <= 0 || !accountId) {
      setError(lang === "es" ? "Por favor, completa todos los campos obligatorios" : "Please fill all required fields");
      return;
    }
    const payload = {
      amount: num,
      type,
      date: toDateString(date),
      description: description || undefined,
      account_id: accountId,
      category_id: categoryId || undefined,
      subcategory_id: subcategoryId || undefined,
    };
    try {
      if (transaction) await updateTx.mutateAsync({ id: transaction.id, ...payload });
      else await createTx.mutateAsync(payload);
      router.replace(safeInternalPath(returnTo, "/transactions"), { scroll: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    }
  };

  return (
    <div className="page-container fade-in">
      <BackButton />
      <h1 className="title" style={{ marginBottom: 24 }}>
        {t(transaction ? "transactions.edit" : "transactions.add")}
      </h1>

      {error && (
        <div style={{ background: "rgba(255,68,68,0.1)", border: "1px solid rgba(255,68,68,0.2)", color: "#ff4444", padding: 12, borderRadius: 12, marginBottom: 16 }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="subs-form">
        <div className="subs-form-section">
          <Label className="subs-form-label" required>
            {t("common.type")}
          </Label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, background: "var(--gris)", padding: 4, borderRadius: 14 }}>
            {(["expense", "income"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setType(option)}
                style={{
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 12,
                  borderRadius: 12,
                  border: "none",
                  background: type === option ? `var(--${option === "income" ? "success" : "danger"})` : "transparent",
                  color: type === option ? "white" : "var(--gris-claro)",
                  fontWeight: 500,
                  fontSize: "0.9rem",
                }}
              >
                {t(`transactions.${option}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="subs-form-section">
          <Label className="subs-form-label" required>
            {t("common.amount")}
          </Label>
          <CurrencyInput placeholder="0,00" value={amount} onChange={setAmount} className="!h-10" />
        </div>

        <div className="subs-form-section">
          <Label className="subs-form-label" required>
            {t("common.date")}
          </Label>
          <DatePicker value={date} onChange={(d) => d && setDate(d)} placeholder={lang === "es" ? "Seleccionar fecha" : "Select date"} lang={lang} />
        </div>

        <div className="subs-form-section">
          <Label className="subs-form-label" optional>
            {t("common.description")}
          </Label>
          <Input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={lang === "es" ? "Ej: Almuerzo, Salario..." : "Lunch, Salary, etc."}
            className="!h-10"
          />
        </div>

        <div className="subs-form-section">
          <Label className="subs-form-label" required>
            {t("common.account")}
          </Label>
          <AccountSelect value={accountId} onChange={setAccountId} placeholder={lang === "es" ? "Seleccionar cuenta" : "Select account"} popperTop />
        </div>

        <div className="subs-form-section">
          <Label className="subs-form-label" optional>
            {t("common.category")}
          </Label>
          <CategorySelect
            value={categoryId}
            onChange={(id) => {
              setCategoryId(id);
              setSubcategoryId("");
            }}
            options={parents}
          />
          {excludedFromMetrics && (
            <p className="mt-2 text-sm text-muted-foreground bg-muted/60 rounded-lg px-3 py-2">{t("categories.excludeFromMetricsInfo")}</p>
          )}
        </div>

        {subcategories.length > 0 && (
          <div className="subs-form-section">
            <Label className="subs-form-label" optional>
              {lang === "es" ? "Subcategoría" : "Subcategory"}
            </Label>
            <CategorySelect value={subcategoryId} onChange={setSubcategoryId} options={subcategories} />
          </div>
        )}

        <SubmitButton pending={createTx.isPending || updateTx.isPending} isEdit={!!transaction}>
          {t(transaction ? "common.save" : "transactions.add")}
        </SubmitButton>
      </form>
    </div>
  );
}
