import AccountEditForm from "@/components/AccountEditForm";
import { BackButton } from "@/components/BackButton";
import type { Account } from "@/hooks/useAccounts";
import { getOwnedRow } from "@/lib/supabase/server";

export default async function AccountEditPage({ params }: { params: Promise<{ id: string }> }) {
  const account = await getOwnedRow<Account>("accounts", (await params).id);
  return (
    <div className="page-container fade-in">
      <BackButton label={account.name} />
      <AccountEditForm account={account} />
    </div>
  );
}
