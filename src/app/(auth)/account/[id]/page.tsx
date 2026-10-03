import AccountDetail from "@/components/AccountDetail";
import type { Account } from "@/hooks/useAccounts";
import { getAccessibleAccount } from "@/lib/supabase/server";

export default async function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const account = await getAccessibleAccount<Account>((await params).id);
  return <AccountDetail account={account} />;
}
