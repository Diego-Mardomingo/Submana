"use client";

import { useState } from "react";
import { SplitEditor, useMemberLabel } from "@/components/SplitEditor";
import { Trash2 } from "lucide-react";
import { ActionRow, AmountField, Chips, FieldGroup, FieldRow, FieldStack, FormError, FormHero, SheetButton } from "@/components/SheetFields";
import { DatePicker } from "@/components/ui/date-picker";
import { Sheet, SheetBody, SheetFooter, SheetForm, useSheetPayload } from "@/components/ui/sheet";
import { useCreateSharedExpense, useUndoableDeleteSharedExpense, useUpdateSharedExpense } from "@/hooks/useSharedExpenses";
import { useLang } from "@/hooks/useLang";
import { parseCurrencyValue } from "@/lib/currency";
import { parseDateString, toDateString } from "@/lib/date";
import { useTranslations } from "@/lib/i18n/utils";
import { toast } from "@/lib/toast";
import { draftParticipants, evaluateDraft, initialDraft, isDraftSubmittable, type SplitDraft } from "@/lib/shared/splitDraft";
import { sharedErrorText } from "@/lib/shared/errorText";
import { toCents } from "@/lib/shared/splits";
import type { SharedExpenseItem, SharedProfile } from "@/lib/shared/types";

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
  const remove = useUndoableDeleteSharedExpense();

  const [amount, setAmount] = useState(expense ? expense.total_amount.toFixed(2).replace(".", ",") : "");
  const [date, setDate] = useState(() => (expense ? parseDateString(expense.date) : new Date()));
  const [payerId, setPayerId] = useState(expense?.paid_by ?? meId);
  const [draft, setDraft] = useState<SplitDraft>(() => (expense ? draftFromExpense(expense) : initialDraft(members.map((m) => m.user_id))));
  const [error, setError] = useState("");
  const [amountInvalid, setAmountInvalid] = useState(false);

  const total = parseCurrencyValue(amount);
  const totalCents = toCents(total);
  const evaluation = evaluateDraft(draft, totalCents, payerId);
  const submittable = totalCents > 0 && draft.title.trim().length > 0 && isDraftSubmittable(evaluation, draft);

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
    };
    try {
      if (expense) await update.mutateAsync({ id: expense.id, ...input });
      else await create.mutateAsync(input);
      toast.success(t(expense ? "shared.expenseSaved" : "shared.expenseCreated"));
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

        {expense && (
          <FieldGroup>
            <ActionRow
              tone="danger"
              icon={<Trash2 aria-hidden />}
              onClick={() => {
                remove(expense);
                onDone();
              }}
            >
              {t("shared.delete")}
            </ActionRow>
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
