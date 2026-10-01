import TransactionForm from "@/components/TransactionForm";
import type { Transaction } from "@/hooks/useTransactions";
import { getOwnedRow } from "@/lib/supabase/server";

export default async function EditTransactionPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const tx = await getOwnedRow<Transaction>("transactions", (await params).id);
  return <TransactionForm transaction={tx} returnTo={(await searchParams).returnTo} />;
}
