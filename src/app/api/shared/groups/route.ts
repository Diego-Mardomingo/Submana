import { NextRequest } from "next/server";
import { getAuthedClient, jsonCachedResponse, jsonError, jsonResponse, jsonServerError, unauthorized } from "@/lib/apiHelpers";
import { fetchProfiles, limitSharedWrites, loadGroupNets, rpcErrorResponse, UUID } from "@/lib/shared/server";
import type { GroupSummary } from "@/lib/shared/types";

/** Groups I belong to with members and my net position in each. */
export async function GET() {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  try {
    const [{ data: groups, error }, { data: memberRows, error: membersError }, nets] = await Promise.all([
      supabase.from("groups").select("id, name, archived_at, created_at").order("created_at", { ascending: false }),
      supabase.from("group_members").select("group_id, user_id"),
      loadGroupNets(supabase),
    ]);
    if (error) throw error;
    if (membersError) throw membersError;

    const profiles = await fetchProfiles(supabase, (memberRows ?? []).map((m) => m.user_id as string));
    const membersOf = new Map<string, string[]>();
    for (const m of memberRows ?? []) membersOf.set(m.group_id, [...(membersOf.get(m.group_id) ?? []), m.user_id]);

    const data: GroupSummary[] = (groups ?? []).map((g) => ({
      ...(g as Omit<GroupSummary, "members" | "my_net_cents">),
      members: (membersOf.get(g.id) ?? []).flatMap((id) => profiles.get(id) ?? []),
      my_net_cents: nets.get(g.id)?.[user.id] ?? 0,
    }));
    return jsonCachedResponse({ data });
  } catch (error) {
    return jsonServerError("shared/groups", error);
  }
}

/** Create a group with friends (every member must be a friend of the creator). */
export async function POST(request: NextRequest) {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();
  const limited = await limitSharedWrites(user.id);
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return jsonError("Invalid JSON body");
  const name = String(body.name ?? "").trim();
  const memberIds: unknown[] = Array.isArray(body.member_ids) ? body.member_ids : [];
  if (name.length < 1 || name.length > 60) return jsonError("invalid_name");
  if (memberIds.length > 30 || !memberIds.every((id) => typeof id === "string" && UUID.test(id))) return jsonError("invalid_members");

  const { data, error } = await supabase.rpc("create_group", { p_name: name, p_member_ids: memberIds });
  if (error) return rpcErrorResponse("shared/groups", error);
  return jsonResponse({ data }, 201);
}
