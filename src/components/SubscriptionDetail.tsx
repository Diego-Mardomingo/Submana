"use client";

import Link from "next/link";
import { useState } from "react";
import { useDeleteSubscription, useUpdateSubscription } from "@/hooks/useSubscriptionMutations";
import { useLang } from "@/hooks/useLang";
import { useTranslations } from "@/lib/i18n/utils";

interface Sub {
  id: string;
  service_name: string;
  icon?: string;
  cost: number;
  start_date: string;
  end_date?: string | null;
  frequency: string;
  frequency_value: number;
}

export default function SubscriptionDetail({ sub }: { sub: Sub }) {
  const t = useTranslations(useLang());
  const [showDelete, setShowDelete] = useState(false);
  const deleteSub = useDeleteSubscription();
  const updateSub = useUpdateSubscription();

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR" }).format(n);

  const handleDelete = async () => {
    await deleteSub.mutateAsync(sub.id);
    window.location.href = "/subscriptions";
  };

  return (
    <>
      <div className="sub-card" style={{ flexDirection: "column", alignItems: "flex-start", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, width: "100%" }}>
          <img src={sub.icon} alt="" className="sub-icon" />
          <div>
            <h1 style={{ margin: 0, fontSize: "1.5rem" }}>{sub.service_name}</h1>
            <p style={{ margin: 4, color: "var(--gris-claro)", fontSize: "1rem" }}>{formatCurrency(Number(sub.cost))} / {sub.frequency}</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <Link href={`/subscription/${sub.id}/edit`} className="add-btn" style={{ padding: "10px 20px" }}>
            {t("sub.edit")}
          </Link>
          <button type="button" className="btn-delete-final" style={{ padding: "10px 20px" }} onClick={() => setShowDelete(true)}>
            {t("sub.delete")}
          </button>
        </div>
      </div>
      {showDelete && (
        <div className="modal-backdrop" onClick={() => setShowDelete(false)}>
          <div className="modal-content delete-confirm" onClick={(e) => e.stopPropagation()}>
            <h2>{t("sub.deleteTitle")}</h2>
            <p>{t("sub.deleteConfirm")}</p>
            <div className="modal-actions">
              <button type="button" className="btn-cancel" onClick={() => setShowDelete(false)}>{t("common.cancel")}</button>
              <button type="button" className="btn-delete-final" onClick={handleDelete} disabled={deleteSub.isPending}>{t("common.delete")}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
