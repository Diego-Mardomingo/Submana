"use client";

import { useState } from "react";
import { useUpdateAccount } from "@/hooks/useAccountMutations";
import { useLang } from "@/hooks/useLang";
import { useTranslations } from "@/lib/i18n/utils";
import { useRouter } from "next/navigation";
import IconPicker from "@/components/IconPicker";
import { Spinner } from "@/components/ui/spinner";

interface Account {
  id: string;
  name: string;
  balance: number;
  icon?: string;
  color?: string;
}

const colors = ["#7c3aed", "#3b82f6", "#10b981", "#f43f5e", "#f59e0b", "#ec4899"];

export default function AccountEditForm({ account }: { account: Account }) {
  const lang = useLang();
  const t = useTranslations(lang);
  const router = useRouter();
  const updateAccount = useUpdateAccount();

  const [icon, setIcon] = useState(account.icon || "");
  const [name, setName] = useState(account.name);
  const [balance, setBalance] = useState(String(account.balance));
  const [color, setColor] = useState(account.color || "#7c3aed");
  const [colorPickerOpen, setColorPickerOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const balanceNum = parseFloat(balance);
    if (!name || isNaN(balanceNum)) return;

    await updateAccount.mutateAsync({
      id: account.id,
      name,
      balance: balanceNum,
      icon: icon || undefined,
      color,
    });
    router.push(`/account/${account.id}`);
  };

  return (
    <>
      <h1 className="title" style={{ marginBottom: 24 }}>
        {t("accounts.edit")}
      </h1>

      <form onSubmit={handleSubmit} className="subs-form">
        <div className="subs-form-section">
          <label className="subs-form-label">{t("sub.icon")}</label>
          <IconPicker defaultIcon={icon} onIconSelect={setIcon} />
        </div>

        <div className="subs-form-section">
          <label className="subs-form-label">{t("settings.name")}</label>
          <input
            type="text"
            className="subs-form-input"
            placeholder="Ex. Main Bank"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div className="subs-form-row">
          <div className="subs-form-section">
            <label className="subs-form-label">{t("accounts.balance")} (€)</label>
            <input
              type="number"
              step="0.01"
              className="subs-form-input"
              placeholder="0.00"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
            />
          </div>
          <div className="subs-form-section">
            <label className="subs-form-label">{t("common.color")}</label>
            <div style={{ position: "relative" }}>
              <button
                type="button"
                className="subs-form-color-btn"
                style={{ backgroundColor: color }}
                onClick={() => setColorPickerOpen(!colorPickerOpen)}
              />
              {colorPickerOpen && (
                <div className="subs-form-color-picker">
                  {colors.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className="subs-form-color-option"
                      style={{
                        backgroundColor: c,
                        border: color === c ? "2px solid var(--blanco)" : "none",
                      }}
                      onClick={() => {
                        setColor(c);
                        setColorPickerOpen(false);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="subs-form-submit"
          disabled={updateAccount.isPending}
        >
          {updateAccount.isPending ? (
            <Spinner className="size-5" />
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
          )}
          {t("common.save")}
        </button>
      </form>
    </>
  );
}
