import { NextRequest } from "next/server";
import { getAuthedClient, jsonError, jsonResponse, unauthorized } from "@/lib/apiHelpers";
import { memberAddedEvents } from "@/lib/notifications/events/subcount";
import { notifyAfter } from "@/lib/notifications/server";
import { limitSharedWrites, rpcErrorResponse, UUID } from "@/lib/shared/server";

type Params = { params: Promise<{ id: string }> };

/** Add a friend to a group. */
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();
  if (!UUID.test(id)) return jsonError("group_not_found", 404);
  const limited = await limitSharedWrites(user.id);
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  if (!body || typeof body.user_id !== "string" || !UUID.test(body.user_id)) return jsonError("invalid_members");

  const { data, error } = await supabase.rpc("add_group_member", { p_group_id: id, p_user_id: body.user_id });
  if (error) return rpcErrorResponse("shared/groups/members", error);
  notifyAfter(() => memberAddedEvents(id, [body.user_id], user.id));
  return jsonResponse({ data }, 201);
}
