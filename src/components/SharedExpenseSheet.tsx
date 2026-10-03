"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { SplitEditor, useMemberLabel } from "@/components/SplitEditor";
import {
  AmountField,
  Chips,
  DeleteAction,
  FieldGroup,
  FieldRow,
  FieldStack,
  FormError,
  FormHero,
  SheetButton,
} from "@/components/SheetFields";
import { DatePicker } from "@/components/ui/date-picker";
import { Sheet, SheetBody, SheetFooter, SheetForm, useSheetPayload } from "@/components/ui/sheet";
import { useCategories, useCategoryLookup } from "@/hooks/useCategories";
import { useCreateSharedExpense, useDeleteSharedExpense, useUpdateSharedExpense } from "@/hooks/useSharedExpenses";
import { useLang } from "@/hooks/useLang";
import { useTransactions } from "@/hooks/useTransactions";
import { parseCurrencyValue } from "@/lib/currency";
import { parseDateString, toDateString } from "@/lib/date";
import { formatCurrency } from "@/lib/format";
import { interpolate, useTranslations } from "@/lib/i18n/utils";
import { draftParticipants, evaluateDraft, initialDraft, isDraftSubmittable, type SplitDraft } from "@/lib/shared/splitDraft";
import { sharedErrorText } from "@/lib/shared/errorText";
import { toCents } from "@/lib/shared/splits";
import type { SharedExpenseItem, SharedProfile } from "@/lib/shared/types";

const keptKey = (expense: SharedExpenseItem) => `shared_mismatch_kept:${expense.id}:${expense.bank_amount}:${expense.total_amount}`;

/** Remembers (in this browser) that the payer chose to keep a total that differs from the bank amount. */
export function isMismatchKept(expense: SharedExpenseItem) {
  try {
    return localStorage.getItem(keptKey(expense)) === "1";
  } catch {
    return false;
  }
}

function keepMismatch(expense: SharedExpenseItem) {
  try {
    localStorage.setItem(keptKey(expense), "1");
  } catch {
    // Storage unavailable: the notice simply reappears next time.
  }
}

/** The payer's bank amount no longer matches the shared total: offer to follow the bank or keep it. */
export function BankMismatchNotice({ totalAmount, bankAmount, onUseBank, onKeep }: {
  totalAmount: number;
  bankAmount: number;
  onUseBank: () => void;
  onKeep: () => void;
}) {
  const t = useTranslations(useLang());
  return (
    <div className="shared-mismatch" role="alert">
      <p>
        <AlertTriangle className="size-4" aria-hidden />
        <span>
          {interpolate(t("shared.mismatch"), { total: formatCurrency(totalAmount), bank: formatCurrency(bankAmount) })}
        </span>
      </p>
      <div className="shared-mismatch-actions">
        <button type="button" className="duplicate-btn duplicate-btn-keep" onClick={onUseBank}>
          {t("shared.mismatch.useBank")}
        </button>
        <button type="button" className="duplicate-btn" onClick={onKeep}>
          {t("shared.mismatch.keep")}
        </button>
      </div>
    </div>
  );
}

function draftFromExpense(expense: SharedExpenseItem): SplitDraft {
  const values: Record<string, string> = {};
  for (const share of expense.shares) {
    if (expense.split_mode === "exact") values[share.user_id] = share.amount.toFixed(2).replace(".", ",");
    else if (share.weight != null) values[share.user_id] = String(share.weight);
  }
  return {
    mode: expense.split_mode,
    included: expense.shares.map((s) => s.user_id),
    values,
    title: expense.title,
  };
}

function ExpenseForm({ groupId, members, meId, expense, onDone }: {
  groupId: string;
  members: SharedProfile[];
  meId: string;
  expense: SharedExpenseItem | null;
  onDone: () => void;
}) {
  const lang = useLang();
  const t = useTranslations(lang);
  const label = useMemberLabel(meId);
  const create = useCreateSharedExpense();
  const update = useUpdateSharedExpense();
  const remove = useDeleteSharedExpense();
  const { data: categoriesData } = useCategories();
  const categoryNames = useCategoryLookup().name;

  const [amount, setAmount] = useState(expense ? expense.total_amount.toFixed(2).replace(".", ",") : "");
  const [date, setDate] = useState(() => (expense ? parseDateString(expense.date) : new Date()));
  const [payerId, setPayerId] = useState(expense?.paid_by ?? meId);
  const [draft, setDraft] = useState<SplitDraft>(() => (expense ? draftFromExpense(expense) : initialDraft(members.map((m) => m.user_id))));
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [linkTxId, setLinkTxId] = useState("");
  const [error, setError] = useState("");
  const [amountInvalid, setAmountInvalid] = useState(false);
  const [mismatchHidden, setMismatchHidden] = useState(false);

  const total = parseCurrencyValue(amount);
  const totalCents = toCents(total);
  const evaluation = evaluateDraft(draft, totalCents, payerId);
  const submittable = totalCents > 0 && draft.title.trim().length > 0 && isDraftSubmittable(evaluation, draft);

  // Only people who get a private row of their own can pick a category (a bank row keeps its own).
  const hasBankRow = !!expense?.my_transaction_id && !expense.my_transaction_virtual;
  const parents = [...(categoriesData?.userCategories ?? []), ...(categoriesData?.defaultCategories ?? [])].filter((c) => !c.parent_id);
  const subcategories = parents.find((c) => c.id === categoryId)?.subcategories ?? [];
  const catLabel = (c: { id: string; name: string }) => categoryNames.get(c.id) ?? c.name;

  // Payer's own unlinked bank expense of the same amount, to attach the expense to it.
  const { data: monthTxs = [] } = useTransactions(date.getFullYear(), date.getMonth() + 1);
  const linkable =
    payerId === meId && !hasBankRow && totalCents > 0
      ? monthTxs.filter((tx) => tx.type === "expense" && tx.account_id && !tx.shared_expense_id && toCents(tx.amount) === totalCents)
      : [];

  const showMismatch = !!expense?.bank_mismatch && expense.bank_amount !== null && !mismatchHidden && !isMismatchKept(expense);
  const useBankAmount = () => {
    if (!expense || expense.bank_amount === null) return;
    setAmount(expense.bank_amount.toFixed(2).replace(".", ","));
    // Exact amounts cannot scale: keep their proportions as shares.
    if (draft.mode === "exact") {
      const values = Object.fromEntries(draft.included.map((id) => [id, String(parseCurrencyValue(draft.values[id] ?? ""))]));
      setDraft({ ...draft, mode: "shares", values });
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (totalCents <= 0) {
      setAmountInvalid(true);
      setError(t("split.error.amount"));
      return;
    }
    if (!submittable) {
      setError(t(draft.title.trim() ? "split.error.invalid" : "split.error.title"));
      return;
    }
    const input = {
      group_id: groupId,
      title: draft.title.trim(),
      total: totalCents / 100,
      date: toDateString(date),
      paid_by: payerId,
      split_mode: draft.mode,
      participants: draftParticipants(draft),
      payer_tx_id: linkTxId || null,
      category_id: categoryId || null,
      subcategory_id: subcategoryId || null,
    };
    try {
      if (expense) await update.mutateAsync({ id: expense.id, ...input });
      else await create.mutateAsync(input);
      onDone();
    } catch (err) {
      setError(sharedErrorText(t, err instanceof Error ? err.message : undefined));
    }
  };

  return (
    <SheetForm onSubmit={submit}>
      <SheetBody>
        <FormHero>
          <AmountField
            id="shared-amount"
            label={t("common.amount")}
            value={amount}
            tone="expense"
            invalid={amountInvalid}
            onChange={(value) => {
              setAmount(value);
              setAmountInvalid(false);
            }}
          />
        </FormHero>

        {showMismatch && expense && (
          <BankMismatchNotice
            totalAmount={expense.total_amount}
            bankAmount={expense.bank_amount!}
            onUseBank={useBankAmount}
            onKeep={() => {
              keepMismatch(expense);
              setMismatchHidden(true);
            }}
          />
        )}

        <FieldGroup>
          <FieldRow label={t("common.date")}>
            <DatePicker value={date} onChange={(d) => d && setDate(d)} placeholder={t("split.pickDate")} lang={lang} className="sf-picker" />
          </FieldRow>
        </FieldGroup>

        <FieldGroup title={t("split.paidBy")}>
          <FieldStack>
            <Chips
              label={t("split.paidBy")}
              value={payerId}
              onChange={setPayerId}
              options={members.map((m) => ({ value: m.user_id, label: label(m) }))}
            />
          </FieldStack>
        </FieldGroup>

        <SplitEditor members={members} meId={meId} totalCents={totalCents} payerId={payerId} draft={draft} onChange={setDraft} />

        {linkable.length > 0 && (
          <FieldGroup title={t("shared.linkBank")} hint={t("shared.linkBankHint")}>
            <FieldStack>
              <Chips
                label={t("shared.linkBank")}
                value={linkTxId}
                onChange={(id) => setLinkTxId(id === linkTxId ? "" : id)}
                options={linkable.map((tx) => ({
                  value: tx.id,
                  label: `${tx.description || t("transactions.expense")} · ${parseDateString(tx.date).toLocaleDateString(lang)}`,
                }))}
              />
            </FieldStack>
          </FieldGroup>
        )}

        {!hasBankRow && (
          <FieldGroup title={t("common.category")} hint={t("shared.categoryHint")}>
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
                  label: catLabel(c),
                  icon: c.emoji ? <span className="sf-chip-emoji">{c.emoji}</span> : undefined,
                }))}
              />
            </FieldStack>
            {subcategories.length > 0 && (
              <FieldStack>
                <Chips
                  label={t("common.category")}
                  value={subcategoryId}
                  onChange={(id) => setSubcategoryId(id === subcategoryId ? "" : id)}
                  options={subcategories.map((c) => ({ value: c.id, label: catLabel(c) }))}
                />
              </FieldStack>
            )}
          </FieldGroup>
        )}

        {expense && (
          <FieldGroup>
            <DeleteAction
              label={t("shared.delete")}
              confirmTitle={t("shared.deleteTitle")}
              confirmText={t("shared.deleteConfirm")}
              pending={remove.isPending}
              onConfirm={async () => {
                await remove.mutateAsync(expense.id);
                onDone();
              }}
            />
          </FieldGroup>
        )}
      </SheetBody>
      <SheetFooter>
        <FormError>{error}</FormError>
        <SheetButton type="submit" pending={create.isPending || update.isPending}>
          {expense ? t("common.save") : t("shared.add")}
        </SheetButton>
      </SheetFooter>
    </SheetForm>
  );
}

/** Create or edit a shared expense from inside a group (any member may edit it). */
export function SharedExpenseSheet({ open, onOpenChange, groupId, members, meId, expense }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  members: SharedProfile[];
  meId: string;
  expense?: SharedExpenseItem | null;
}) {
  const t = useTranslations(useLang());
  const shown = useSheetPayload(open, expense ?? null);
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t(shown ? "shared.edit" : "shared.add")}>
      <ExpenseForm key={shown?.id ?? "new"} groupId={groupId} members={members} meId={meId} expense={shown} onDone={() => onOpenChange(false)} />
    </Sheet>
  );
}
