import AccountDetail from "@/components/AccountDetail";
import { BackButton } from "@/components/BackButton";
import type { Account } from "@/hooks/useAccounts";
import { getOwnedRow } from "@/lib/supabase/server";

export default async function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const account = await getOwnedRow<Account>("accounts", (await params).id);
  return (
    <div className="page-container fade-in">
      <BackButton />
      <AccountDetail account={account} />
    </div>
  );
}
