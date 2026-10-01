"use client";

import { useRouter } from "next/navigation";
import { AccountForm } from "@/components/AccountForm";
import type { Account } from "@/hooks/useAccounts";
import { useLang } from "@/hooks/useLang";
import { useTranslations } from "@/lib/i18n/utils";

export default function AccountEditForm({ account }: { account: Account }) {
  const t = useTranslations(useLang());
  const router = useRouter();
  const back = () => router.push(`/account/${account.id}`);
  return (
    <>
      <h1 className="title" style={{ marginBottom: 24 }}>
        {t("accounts.edit")}
      </h1>
      <AccountForm account={account} onDone={back} onCancel={back} />
    </>
  );
}
