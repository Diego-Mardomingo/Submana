"use client";

import { useState } from "react";
import { useUpdateAccount } from "@/hooks/useAccountMutations";
import { useLang } from "@/hooks/useLang";
import { useTranslations } from "@/lib/i18n/utils";
import { useRouter } from "next/navigation";
import IconPicker from "@/components/IconPicker";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

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
          <Label className="subs-form-label" optional>{t("sub.icon")}</Label>
          <IconPicker defaultIcon={icon} onIconSelect={setIcon} />
        </div>

        <div className="subs-form-section">
          <Label className="subs-form-label" required>{t("settings.name")}</Label>
          <Input
            type="text"
            placeholder="Ex. Main Bank"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="!h-10"
          />
        </div>

        <div className="subs-form-row">
          <div className="subs-form-section">
            <Label className="subs-form-label" required>{t("accounts.balance")}</Label>
            <InputGroup className="!h-10">
              <InputGroupInput
                type="number"
                step="0.01"
                placeholder="0.00"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                required
              />
              <InputGroupAddon align="inline-end">€</InputGroupAddon>
            </InputGroup>
          </div>
          <div className="subs-form-section">
            <Label className="subs-form-label">{t("common.color")}</Label>
            <Popover open={colorPickerOpen} onOpenChange={setColorPickerOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="subs-form-color-btn"
                  style={{ backgroundColor: color }}
                />
              </PopoverTrigger>
              <PopoverContent className="w-auto p-3" align="start">
                <div className="grid grid-cols-3 gap-2">
                  {colors.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className="size-7 rounded-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
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
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <Button
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
        </Button>
      </form>
    </>
  );
}
