import SubscriptionForm from "@/components/SubscriptionForm";
import type { Subscription } from "@/hooks/useSubscriptions";
import { getOwnedRow } from "@/lib/supabase/server";

export default async function EditSubscriptionPage({ params }: { params: Promise<{ id: string }> }) {
  return <SubscriptionForm sub={await getOwnedRow<Subscription>("subscriptions", (await params).id)} />;
}
