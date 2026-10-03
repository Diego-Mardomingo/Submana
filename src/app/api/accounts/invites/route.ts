import { getAuthedClient, jsonCachedResponse, jsonServerError, unauthorized } from "@/lib/apiHelpers";
import { fetchProfiles } from "@/lib/shared/server";

/** Pending joint-account invitations addressed to me, with the inviter's profile. */
export async function GET() {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const { data, error } = await supabase.rpc("my_account_invites");
  if (error) return jsonServerError("accounts/invites", error);

  const rows = (data ?? []) as { account_id: string; account_name: string; icon: string | null; color: string | null; owner_id: string; invited_at: string }[];
  const profiles = await fetchProfiles(supabase, rows.map((r) => r.owner_id));
  return jsonCachedResponse({
    data: rows.map((r) => ({
      account_id: r.account_id,
      name: r.account_name,
      icon: r.icon,
      color: r.color,
      invited_at: r.invited_at,
      owner: profiles.get(r.owner_id) ?? null,
    })),
  });
}
