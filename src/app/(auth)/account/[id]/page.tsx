import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import AccountDetail from "@/components/AccountDetail";
import { BackButton } from "@/components/BackButton";

interface Account {
  id: string;
  name: string;
  balance: number;
  icon?: string;
  color?: string;
  is_default?: boolean;
}

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: account, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !account) {
    notFound();
  }

  return (
    <div className="page-container fade-in">
      <BackButton />

      <AccountDetail account={account as Account} />
    </div>
  );
}
