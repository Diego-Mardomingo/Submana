"use client";

import { HandCoins } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/hooks/useLang";
import { useRecordSettlement } from "@/hooks/useSharedExpenses";
import { formatCurrency } from "@/lib/format";
import { interpolate, useTranslations } from "@/lib/i18n/utils";
import { sharedErrorText } from "@/lib/shared/errorText";
import { fromCents } from "@/lib/shared/splits";
import type { SettlementSuggestionItem } from "@/lib/shared/types";

/** "Looks like @ana paying you back 20 €": one tap records the settlement and links the transaction. */
export function SettlementSuggestionChip({ suggestion, meId }: { suggestion: SettlementSuggestionItem; meId: string }) {
  const t = useTranslations(useLang());
  const record = useRecordSettlement();
  const fromFriend = suggestion.direction === "from_friend";

  const link = () =>
    record.mutate(
      {
        group_id: suggestion.group_id,
        from: fromFriend ? suggestion.friend.user_id : meId,
        to: fromFriend ? meId : suggestion.friend.user_id,
        amount: fromCents(suggestion.amount_cents),
        transaction_id: suggestion.tx_id,
      },
      {
        onSuccess: () => toast.success(t("settle.linked")),
        onError: (err) => toast.error(sharedErrorText(t, err.message)),
      }
    );

  return (
    <div className="settle-suggestion">
      <HandCoins className="size-4 shrink-0" aria-hidden />
      <span className="settle-suggestion-text">
        {interpolate(t(fromFriend ? "settle.suggest.fromFriend" : "settle.suggest.toFriend"), {
          handle: suggestion.friend.handle,
          amount: formatCurrency(fromCents(suggestion.amount_cents)),
        })}
      </span>
      <button type="button" className="duplicate-btn duplicate-btn-keep" onClick={link} disabled={record.isPending}>
        {t("settle.suggest.link")}
      </button>
    </div>
  );
}
