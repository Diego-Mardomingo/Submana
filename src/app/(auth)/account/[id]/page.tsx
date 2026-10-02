import AccountDetail from "@/components/AccountDetail";
import type { Account } from "@/hooks/useAccounts";
import { getOwnedRow } from "@/lib/supabase/server";

export default async function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const account = await getOwnedRow<Account>("accounts", (await params).id);
  return <AccountDetail account={account} />;
}
