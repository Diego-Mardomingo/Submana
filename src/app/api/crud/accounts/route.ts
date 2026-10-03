import { NextRequest } from "next/server";
import { getAuthedClient, jsonCachedResponse, listAccessibleAccounts, jsonError, jsonResponse, jsonServerError, parseRequestBody, unauthorized } from "@/lib/apiHelpers";
import { fetchProfiles } from "@/lib/shared/server";

export async function GET() {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  // Owned accounts plus joint accounts I accepted (mine first, in my order).
  const { ids } = await listAccessibleAccounts(supabase, user.id);
  if (ids.length === 0) return jsonCachedResponse({ data: [] });
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .in("id", ids)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) return jsonServerError("crud/accounts", error);

  const jointIds = (data ?? []).filter((a) => a.is_joint).map((a) => a.id as string);
  const { data: memberRows } = jointIds.length
    ? await supabase.from("account_members").select("account_id, user_id, role, status, added_at").in("account_id", jointIds)
    : { data: [] };
  const profiles = await fetchProfiles(supabase, (memberRows ?? []).map((m) => m.user_id as string));
  const membersByAccount = new Map<string, unknown[]>();
  for (const m of memberRows ?? []) {
    const list = membersByAccount.get(m.account_id as string) ?? [];
    list.push({ user_id: m.user_id, role: m.role, status: m.status, added_at: m.added_at, profile: profiles.get(m.user_id as string) ?? null });
    membersByAccount.set(m.account_id as string, list);
  }

  const mine = (data ?? []).map((a) => ({
    ...a,
    is_joint: !!a.is_joint,
    my_role: a.user_id === user.id ? "owner" : "member",
    members: membersByAccount.get(a.id as string) ?? [],
  }));
  // Own accounts first (their order is mine to set); joint accounts of others after them.
  return jsonCachedResponse({ data: [...mine.filter((a) => a.my_role === "owner"), ...mine.filter((a) => a.my_role !== "owner")] });
}

export async function POST(request: NextRequest) {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const { name, icon, color, ...body } = await parseRequestBody(request);
  const balance = body.balance ? parseFloat(body.balance) : 0;
  if (!name || isNaN(balance)) return jsonError("missing_fields");

  const { count } = await supabase.from("accounts").select("*", { count: "exact", head: true }).eq("user_id", user.id);
  const { data, error } = await supabase
    .from("accounts")
    .insert({ user_id: user.id, name, balance, icon, color, bank_provider: body.bank_provider || null, display_order: count ?? 0 })
    .select()
    .single();
  if (error) return jsonServerError("crud/accounts", error);
  return jsonResponse({ data }, 201);
}
