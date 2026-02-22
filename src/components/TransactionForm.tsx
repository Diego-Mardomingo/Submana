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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
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
  const { data: categoriesData } = useCategories();
  const createTx = useCreateTransaction();
  const updateTx = useUpdateTransaction();

  const categories: CategoryWithSubs[] = [
    ...(categoriesData?.defaultCategories ?? []),
    ...(categoriesData?.userCategories ?? []),
  ];
  const parents = categories.filter((c) => !("parent_id" in c) || !(c as { parent_id?: string }).parent_id);

  const [type, setType] = useState<"income" | "expense">(editData?.type === "income" ? "income" : "expense");
  const [amount, setAmount] = useState(editData ? String(editData.amount) : "");
  const [date, setDate] = useState<Date>(
    editData?.date ? new Date(editData.date) : new Date()
  );
  const [description, setDescription] = useState(editData?.description || "");
  const [accountId, setAccountId] = useState(editData?.account_id || "none");
  const [categoryId, setCategoryId] = useState(editData?.category_id || "none");
  const [subcategoryId, setSubcategoryId] = useState(editData?.subcategory_id || "none");
  const [error, setError] = useState("");

  useEffect(() => {
    const def = (accounts as Array<{ id: string; is_default?: boolean }>).find((a) => a.is_default);
    if (!editData && accountId === "none" && def) setAccountId(def.id);
  }, [accounts, accountId, editData]);

  const subcategories = categories.find((c) => c.id === categoryId)?.subcategories || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0 || !date) {
      setError(lang === "es" ? "Por favor, completa todos los campos obligatorios" : "Please fill all required fields");
      return;
    }
    const payload = {
      amount: num,
      type,
      date: date.toISOString().slice(0, 10),
      description: description || undefined,
      account_id: accountId && accountId !== "none" ? accountId : undefined,
      category_id: categoryId && categoryId !== "none" ? categoryId : undefined,
      subcategory_id: subcategoryId && subcategoryId !== "none" ? subcategoryId : undefined,
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
    <div className="page-container fade-in">
      <Link 
        href="/transactions" 
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
        {t("nav.transactions")}
      </Link>

      <h1 className="title" style={{ marginBottom: 24 }}>
        {editData ? t("transactions.edit") : t("transactions.add")}
      </h1>

      {error && (
        <div style={{ background: "rgba(255,68,68,0.1)", border: "1px solid rgba(255,68,68,0.2)", color: "#ff4444", padding: 12, borderRadius: 12, marginBottom: 16 }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="subs-form">
        {/* Type Toggle */}
        <div className="subs-form-section">
          <Label className="subs-form-label" required>{t("common.type")}</Label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, background: "var(--gris)", padding: 4, borderRadius: 14 }}>
            <button
              type="button"
              onClick={() => setType("expense")}
              style={{ 
                cursor: "pointer", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center", 
                padding: 12, 
                borderRadius: 12, 
                border: "none",
                background: type === "expense" ? "var(--danger)" : "transparent", 
                color: type === "expense" ? "white" : "var(--gris-claro)",
                fontWeight: 500,
                fontSize: "0.9rem"
              }}
            >
              {t("transactions.expense")}
            </button>
            <button
              type="button"
              onClick={() => setType("income")}
              style={{ 
                cursor: "pointer", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center", 
                padding: 12, 
                borderRadius: 12,
                border: "none",
                background: type === "income" ? "var(--success)" : "transparent", 
                color: type === "income" ? "white" : "var(--gris-claro)",
                fontWeight: 500,
                fontSize: "0.9rem"
              }}
            >
              {t("transactions.income")}
            </button>
          </div>
        </div>

        {/* Amount */}
        <div className="subs-form-section">
          <Label className="subs-form-label" required>{t("common.amount")}</Label>
          <InputGroup className="!h-10">
            <InputGroupInput
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            <InputGroupAddon align="inline-end">€</InputGroupAddon>
          </InputGroup>
        </div>

        {/* Date */}
        <div className="subs-form-section">
          <Label className="subs-form-label" required>{t("common.date")}</Label>
          <DatePicker
            value={date}
            onChange={(d) => d && setDate(d)}
            placeholder={lang === "es" ? "Seleccionar fecha" : "Select date"}
            lang={lang}
          />
        </div>

        {/* Description */}
        <div className="subs-form-section">
          <Label className="subs-form-label" optional>{t("common.description")}</Label>
          <Input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={lang === "es" ? "Ej: Almuerzo, Salario..." : "Lunch, Salary, etc."}
            className="!h-10"
          />
        </div>

        {/* Account */}
        <div className="subs-form-section">
          <Label className="subs-form-label" optional>{t("common.account")}</Label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger className="w-full !h-10">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">—</SelectItem>
              {(accounts as Array<{ id: string; name: string; color?: string }>).map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  <span className="flex items-center gap-2">
                    <span
                      className="size-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: a.color || "var(--accent)" }}
                    />
                    {a.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Category */}
        <div className="subs-form-section">
          <Label className="subs-form-label" optional>{t("common.category")}</Label>
          <Select value={categoryId} onValueChange={(v) => { setCategoryId(v); setSubcategoryId("none"); }}>
            <SelectTrigger className="w-full !h-10">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">—</SelectItem>
              {parents.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Subcategory */}
        {subcategories.length > 0 && (
          <div className="subs-form-section">
            <Label className="subs-form-label" optional>
              {lang === "es" ? "Subcategoría" : "Subcategory"}
            </Label>
            <Select value={subcategoryId} onValueChange={setSubcategoryId}>
              <SelectTrigger className="w-full !h-10">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {subcategories.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Submit */}
        <Button 
          type="submit" 
          className="subs-form-submit" 
          disabled={pending}
        >
          {pending ? (
            <Spinner className="size-5" />
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {editData ? (
                <>
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </>
              ) : (
                <>
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </>
              )}
            </svg>
          )}
          {editData ? t("common.save") : t("transactions.add")}
        </Button>
      </form>
    </div>
  );
}
