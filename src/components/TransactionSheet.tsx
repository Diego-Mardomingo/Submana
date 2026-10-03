"use client";

import { useState } from "react";
import {
  AmountField,
  Chips,
  DeleteAction,
  FieldGroup,
  FieldRow,
  FieldStack,
  FormError,
  FormHero,
  RowInput,
  Segmented,
  SheetButton,
} from "@/components/SheetFields";
import { DatePicker } from "@/components/ui/date-picker";
import { Sheet, SheetBody, SheetFooter, SheetForm, useSheetPayload } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { parseCurrencyValue } from "@/lib/currency";
import { useAccounts } from "@/hooks/useAccounts";
import { useCategories, useCategoryLookup } from "@/hooks/useCategories";
import { useLang } from "@/hooks/useLang";
import {
  useCreateTransaction,
  useDeleteTransaction,
  useSimilarTransactions,
  useTransaction,
  useUpdateTransaction,
  type Transaction,
} from "@/hooks/useTransactions";
import { parseDateString, toDateString } from "@/lib/date";
import { SensitiveAmount } from "@/components/SensitiveAmount";
import { formatCurrency, localeOf } from "@/lib/format";
import { interpolate, useTranslations } from "@/lib/i18n/utils";

function TransactionForm({ transaction, defaultAccountId, defaultDate, onDone, onUseSimilar }: {
  transaction: Transaction | null;
  defaultAccountId?: string;
  defaultDate?: Date;
  onDone: () => void;
  /** Create mode only: switch to editing a bank-backed transaction that already exists. */
  onUseSimilar?: (tx: Transaction) => void;
}) {
  const lang = useLang();
  const es = lang === "es";
  const t = useTranslations(lang);
  const { data: accounts = [] } = useAccounts();
  const { data: categoriesData } = useCategories();
  const categoryNames = useCategoryLookup().name;
  const createTx = useCreateTransaction();
  const updateTx = useUpdateTransaction();
  const deleteTx = useDeleteTransaction();

  const [type, setType] = useState<"income" | "expense">(transaction?.type ?? "expense");
  const [amount, setAmount] = useState(transaction ? Number(transaction.amount).toFixed(2).replace(".", ",") : "");
  const [date, setDate] = useState(() => (transaction ? parseDateString(transaction.date) : (defaultDate ?? new Date())));
  const [description, setDescription] = useState(transaction?.description ?? "");
  const [pickedAccountId, setAccountId] = useState(transaction?.account_id ?? "");
  const [categoryId, setCategoryId] = useState(transaction?.category_id ?? "");
  const [subcategoryId, setSubcategoryId] = useState(transaction?.subcategory_id ?? "");
  const [error, setError] = useState("");
  const [amountInvalid, setAmountInvalid] = useState(false);

  // New transactions default to the page's account, then to the account marked as default.
  const accountId = pickedAccountId || (transaction ? "" : (defaultAccountId ?? accounts.find((a) => a.is_default)?.id ?? ""));
  // Joint accounts only use system categories: a member's personal categories mean nothing to the others.
  const jointAccount = !!accounts.find((a) => a.id === accountId)?.is_joint;
  const parents = [...(jointAccount ? [] : (categoriesData?.userCategories ?? [])), ...(categoriesData?.defaultCategories ?? [])].filter((c) => !c.parent_id);
  const category = parents.find((c) => c.id === categoryId);
  const subcategories = category?.subcategories ?? [];
  const excludedFromMetrics = category?.exclude_from_metrics || subcategories.find((s) => s.id === subcategoryId)?.exclude_from_metrics;
  const label = (c: { id: string; name: string }) => categoryNames.get(c.id) ?? c.name;

  // While creating, look for a bank movement that is probably this same one (avoids a twin the next import must reconcile).
  const { data: similar = [] } = useSimilarTransactions({
    accountId: transaction ? "" : accountId,
    amount: parseCurrencyValue(amount),
    type,
    date: toDateString(date),
    description: description.trim(),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const num = parseCurrencyValue(amount);
    if (num <= 0) {
      setAmountInvalid(true);
      setError(es ? "Introduce un importe mayor que 0" : "Enter an amount greater than 0");
      return;
    }
    if (!accountId) {
      setError(es ? "Elige una cuenta" : "Choose an account");
      return;
    }
    const payload = {
      amount: num,
      type,
      date: toDateString(date),
      description: description.trim() || undefined,
      account_id: accountId,
      category_id: (jointAccount && !category ? "" : categoryId) || undefined,
      subcategory_id: (jointAccount && !category ? "" : subcategoryId) || undefined,
    };
    try {
      if (transaction) await updateTx.mutateAsync({ id: transaction.id, ...payload });
      else await createTx.mutateAsync(payload);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    }
  };

  return (
    <SheetForm onSubmit={handleSubmit}>
      <SheetBody>
        <Segmented
          label={t("common.type")}
          value={type}
          onChange={setType}
          options={[
            { value: "expense", label: t("transactions.expense"), tone: "expense" },
            { value: "income", label: t("transactions.income"), tone: "income" },
          ]}
        />

        <FormHero>
          <AmountField
            id="tx-amount"
            label={t("common.amount")}
            value={amount}
            tone={type}
            invalid={amountInvalid}
            onChange={(value) => {
              setAmount(value);
              setAmountInvalid(false);
            }}
          />
        </FormHero>

        {!transaction && onUseSimilar && similar.length > 0 && (
          <div className="similar-banner">
            <span className="similar-banner-title">{t("tx.similar.title")}</span>
            {similar.map((tx) => (
              <div key={tx.id} className="similar-banner-item">
                <div className="similar-banner-text">
                  <span>{tx.bank_description || tx.description || "—"}</span>
                  <span>
                    {interpolate(t("tx.similar.booked"), { date: parseDateString(tx.booked_at ?? tx.date).toLocaleDateString(localeOf(lang)) })}
                    {" · "}
                    <SensitiveAmount>{formatCurrency(Number(tx.amount))}</SensitiveAmount>
                  </span>
                </div>
                <button
                  type="button"
                  className="duplicate-btn duplicate-btn-keep"
                  onClick={() =>
                    onUseSimilar({
                      ...tx,
                      // Keep what the user already typed: the bank row only gains their category and description.
                      description: description.trim() || tx.description,
                      category_id: categoryId || tx.category_id,
                      subcategory_id: subcategoryId || tx.subcategory_id,
                    })
                  }
                >
                  {t("tx.similar.use")}
                </button>
              </div>
            ))}
          </div>
        )}

        <FieldGroup>
          <FieldRow label={t("common.description")} htmlFor="tx-description">
            <RowInput
              id="tx-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={es ? "Almuerzo, nómina…" : "Lunch, salary…"}
              enterKeyHint="done"
            />
          </FieldRow>
          <FieldRow label={t("common.date")}>
            <DatePicker value={date} onChange={(d) => d && setDate(d)} placeholder={es ? "Elegir fecha" : "Pick a date"} lang={lang} className="sf-picker" />
          </FieldRow>
        </FieldGroup>

        <FieldGroup title={t("common.account")}>
          <FieldStack>
            {accounts.length === 0 ? (
              <p className="sf-hint">{es ? "Crea primero una cuenta" : "Create an account first"}</p>
            ) : (
              <Chips
                scroll
                label={t("common.account")}
                value={accountId}
                onChange={(id) => {
                  setAccountId(id);
                  setError("");
                }}
                options={accounts.map((a) => ({
                  value: a.id,
                  label: a.name,
                  color: a.color || "var(--accent)",
                  icon: <span className="sf-chip-dot" aria-hidden />,
                }))}
              />
            )}
          </FieldStack>
        </FieldGroup>

        <FieldGroup title={t("common.category")} hint={jointAccount ? t("joint.categoriesHint") : excludedFromMetrics ? t("categories.excludeFromMetricsInfo") : undefined}>
          <FieldStack>
            <Chips
              label={t("common.category")}
              value={categoryId}
              onChange={(id) => {
                setCategoryId(id === categoryId ? "" : id);
                setSubcategoryId("");
              }}
              options={parents.map((c) => ({
                value: c.id,
                label: label(c),
                icon: c.emoji ? <span className="sf-chip-emoji">{c.emoji}</span> : undefined,
              }))}
            />
          </FieldStack>
          {subcategories.length > 0 && (
            <FieldStack label={es ? "Subcategoría" : "Subcategory"}>
              <Chips
                label={es ? "Subcategoría" : "Subcategory"}
                value={subcategoryId}
                onChange={(id) => setSubcategoryId(id === subcategoryId ? "" : id)}
                options={subcategories.map((c) => ({
                  value: c.id,
                  label: label(c),
                  icon: c.emoji ? <span className="sf-chip-emoji">{c.emoji}</span> : undefined,
                }))}
              />
            </FieldStack>
          )}
        </FieldGroup>

        {transaction && (
          <FieldGroup>
            <DeleteAction
              label={es ? "Eliminar transacción" : "Delete transaction"}
              confirmTitle={es ? "¿Eliminar esta transacción?" : "Delete this transaction?"}
              confirmText={t("transactions.deleteConfirm")}
              confirmLabel={es ? "Sí, eliminar" : "Yes, delete"}
              pending={deleteTx.isPending}
              onConfirm={async () => {
                await deleteTx.mutateAsync(transaction.id);
                onDone();
              }}
            />
          </FieldGroup>
        )}
      </SheetBody>

      <SheetFooter>
        <FormError>{error}</FormError>
        <SheetButton type="submit" pending={createTx.isPending || updateTx.isPending}>
          {transaction ? (es ? "Guardar cambios" : "Save changes") : t("transactions.add")}
        </SheetButton>
      </SheetFooter>
    </SheetForm>
  );
}

/** Create/edit form; while creating, "use it" on a similar bank movement swaps to editing that one. */
function TransactionFormBody(props: { transaction: Transaction | null; defaultAccountId?: string; defaultDate?: Date; onDone: () => void }) {
  const [adopted, setAdopted] = useState<Transaction | null>(null);
  return (
    <TransactionForm
      key={adopted?.id ?? "form"}
      {...props}
      transaction={adopted ?? props.transaction}
      onUseSimilar={props.transaction ? undefined : setAdopted}
    />
  );
}

/** Loads a transaction known only by id (e.g. from a notification) before showing the form. */
function TransactionById({ id, onDone }: { id: string; onDone: () => void }) {
  const es = useLang() === "es";
  const { data, isLoading, isError } = useTransaction(id);
  if (data) return <TransactionFormBody transaction={data} onDone={onDone} />;
  return (
    <SheetBody className="items-center justify-center py-12 text-sm text-[var(--gris-claro)]">
      {isLoading ? <Spinner className="size-6" /> : isError && (es ? "No se encontró la transacción" : "Transaction not found")}
    </SheetBody>
  );
}

/** Create, edit or delete a transaction: pass the `transaction`, or only its `transactionId`. */
export function TransactionSheet({ open, onOpenChange, transaction, transactionId, defaultAccountId, defaultDate }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: Transaction | null;
  transactionId?: string | null;
  /** Preselected account for new transactions (e.g. from an account's page). */
  defaultAccountId?: string;
  /** Preselected date for new transactions (e.g. the day picked in the calendar). */
  defaultDate?: Date;
}) {
  const t = useTranslations(useLang());
  const shown = useSheetPayload(open, transaction ?? null);
  const shownId = useSheetPayload(open, transactionId ?? null);
  const close = () => onOpenChange(false);
  const editing = !!shown || !!shownId;
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t(editing ? "transactions.edit" : "transactions.add")}>
      {shown || !shownId ? (
        <TransactionFormBody transaction={shown} defaultAccountId={defaultAccountId} defaultDate={defaultDate} onDone={close} />
      ) : (
        <TransactionById id={shownId} onDone={close} />
      )}
    </Sheet>
  );
}
