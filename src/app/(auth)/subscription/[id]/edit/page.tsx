import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SubscriptionEditForm from "@/components/SubscriptionEditForm";

export default async function EditSubscriptionPage({
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

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!sub) redirect("/subscriptions");

  return <SubscriptionEditForm sub={sub} />;
}
