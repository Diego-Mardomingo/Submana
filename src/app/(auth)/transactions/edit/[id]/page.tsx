import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import TransactionForm from "@/components/TransactionForm";

export default async function EditTransactionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: tx } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!tx) redirect("/transactions");

  const dateStr = typeof tx.date === "string" ? tx.date : (tx.date as Date)?.toISOString?.()?.slice(0, 10) ?? "";
  const editData = {
    id: tx.id,
    amount: Number(tx.amount),
    type: tx.type as string,
    date: dateStr,
    description: tx.description ?? undefined,
    account_id: tx.account_id ?? undefined,
    category_id: tx.category_id ?? undefined,
    subcategory_id: tx.subcategory_id ?? undefined,
  };

  return <TransactionForm editData={editData} />;
}
