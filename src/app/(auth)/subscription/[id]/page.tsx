import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import SubscriptionDetail from "@/components/SubscriptionDetail";

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
    <div className="page-container">
      <Link href="/subscriptions" style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 24, color: "var(--gris-claro)", textDecoration: "none" }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6" /></svg>
        Subscriptions
      </Link>
      <SubscriptionDetail sub={sub} />
    </div>
  );
}
