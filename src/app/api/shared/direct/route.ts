import { NextRequest } from "next/server";
import { getAuthedClient, jsonError, jsonResponse, unauthorized } from "@/lib/apiHelpers";
import { limitSharedWrites, rpcErrorResponse, UUID } from "@/lib/shared/server";

/** The implicit 1:1 group with a friend (created on first use). */
export async function POST(request: NextRequest) {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();
  const limited = await limitSharedWrites(user.id);
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  if (!body || typeof body.friend_id !== "string" || !UUID.test(body.friend_id)) return jsonError("not_friends");

  const { data, error } = await supabase.rpc("get_or_create_direct_group", { p_friend_id: body.friend_id });
  if (error) return rpcErrorResponse("shared/direct", error);
  return jsonResponse({ data });
}
