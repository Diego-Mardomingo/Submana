"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { useMemberLabel } from "@/components/SplitEditor";
import { AmountField, FieldGroup, FieldRow, FormError, FormHero, SheetButton } from "@/components/SheetFields";
import { DatePicker } from "@/components/ui/date-picker";
import { Sheet, SheetBody, SheetFooter, SheetForm, useSheetPayload } from "@/components/ui/sheet";
import { useLang } from "@/hooks/useLang";
import { useRecordSettlement } from "@/hooks/useSharedExpenses";
import { parseCurrencyValue } from "@/lib/currency";
import { toDateString } from "@/lib/date";
import { formatCurrency } from "@/lib/format";
import { interpolate, useTranslations } from "@/lib/i18n/utils";
import { toast } from "@/lib/toast";
import type { Transfer } from "@/lib/shared/debts";
import { sharedErrorText } from "@/lib/shared/errorText";
import { fromCents, toCents } from "@/lib/shared/splits";
import type { SharedProfile } from "@/lib/shared/types";

function SettleForm({ groupId, members, meId, transfer, onDone }: {
  groupId: string;
  members: SharedProfile[];
  meId: string;
  transfer: Transfer;
  onDone: () => void;
}) {
  const lang = useLang();
  const t = useTranslations(lang);
  const label = useMemberLabel(meId);
  const record = useRecordSettlement();
  const byId = new Map(members.map((m) => [m.user_id, m]));
  const from = byId.get(transfer.from);
  const to = byId.get(transfer.to);
  const iPay = transfer.from === meId;

  const [amount, setAmount] = useState(fromCents(transfer.cents).toFixed(2).replace(".", ","));
  const [date, setDate] = useState(new Date());
  const [error, setError] = useState("");

  const cents = toCents(parseCurrencyValue(amount));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!from || !to || cents <= 0) {
      setError(t("split.error.amount"));
      return;
    }
    try {
      await record.mutateAsync({
        group_id: groupId,
        from: transfer.from,
        to: transfer.to,
        amount: cents / 100,
        date: toDateString(date),
      });
      toast.success(interpolate(t("settle.done"), { amount: formatCurrency(cents / 100) }));
      onDone();
    } catch (err) {
      setError(sharedErrorText(t, err instanceof Error ? err.message : undefined));
    }
  };

  return (
    <SheetForm onSubmit={submit}>
      <SheetBody>
        {from && to && (
          <div className="settle-pair">
            <ProfileAvatar name={from.display_name} url={from.avatar_url} size={40} />
            <ArrowRight className="size-5 text-muted-foreground" aria-hidden />
            <ProfileAvatar name={to.display_name} url={to.avatar_url} size={40} />
            <p>{iPay ? `${t("settle.youPay")} ${label(to)}` : `${label(from)} ${t("settle.paysYou")}`}</p>
          </div>
        )}
        <FormHero>
          <AmountField id="settle-amount" label={t("common.amount")} value={amount} tone="expense" onChange={setAmount} />
        </FormHero>
        <FieldGroup hint={t("settle.partialHint")}>
          <FieldRow label={t("common.date")}>
            <DatePicker value={date} onChange={(d) => d && setDate(d)} placeholder={t("split.pickDate")} lang={lang} className="sf-picker" />
          </FieldRow>
        </FieldGroup>
      </SheetBody>
      <SheetFooter>
        <FormError>{error}</FormError>
        <SheetButton type="submit" pending={record.isPending}>
          {t("settle.confirm")}
        </SheetButton>
      </SheetFooter>
    </SheetForm>
  );
}

/** Record that a debt was paid ("settle up"). */
export function SettleUpSheet({ open, onOpenChange, groupId, members, meId, transfer }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  members: SharedProfile[];
  meId: string;
  transfer: Transfer | null;
}) {
  const t = useTranslations(useLang());
  const shown = useSheetPayload(open, transfer);
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t("settle.title")}>
      {shown && (
        <SettleForm
          key={`${shown.from}-${shown.to}-${shown.cents}`}
          groupId={groupId}
          members={members}
          meId={meId}
          transfer={shown}
          onDone={() => onOpenChange(false)}
        />
      )}
    </Sheet>
  );
}
