import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SubscriptionDetail from "@/components/SubscriptionDetail";
import { BackButton } from "@/components/BackButton";

export default async function SubscriptionDetailPage({
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

  return (
    <div className="page-container fade-in">
      <BackButton />
      <SubscriptionDetail sub={sub} />
    </div>
  );
}
