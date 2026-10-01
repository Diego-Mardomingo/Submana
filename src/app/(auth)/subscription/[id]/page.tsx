import { BackButton } from "@/components/BackButton";
import SubscriptionDetail from "@/components/SubscriptionDetail";
import type { Subscription } from "@/hooks/useSubscriptions";
import { getOwnedRow } from "@/lib/supabase/server";

export default async function SubscriptionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const sub = await getOwnedRow<Subscription>("subscriptions", (await params).id);
  return (
    <div className="page-container fade-in">
      <BackButton />
      <SubscriptionDetail sub={sub} />
    </div>
  );
}
