import { NextRequest } from "next/server";
import { getAuthedClient, jsonError, jsonResponse, unauthorized } from "@/lib/apiHelpers";
import { inviteAnsweredEvents, inviteReceivedEvents } from "@/lib/notifications/events/joint";
import { notifyAfter } from "@/lib/notifications/server";
import { limitSharedWrites, rpcErrorResponse, UUID } from "@/lib/shared/server";

type Params = { params: Promise<{ id: string }> };

/** Owner invites a friend to a joint account (pending until the friend accepts). */
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();
  if (!UUID.test(id)) return jsonError("account_not_found", 404);
  const limited = await limitSharedWrites(user.id);
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  if (!body || typeof body.friend_id !== "string" || !UUID.test(body.friend_id)) return jsonError("invalid_members");

  const { data, error } = await supabase.rpc("invite_account_member", { p_account: id, p_friend: body.friend_id });
  if (error) return rpcErrorResponse("accounts/members", error);
  notifyAfter(() => inviteReceivedEvents(data as { account_id: string; user_id: string; status: string; added_at: string }, user.id));
  return jsonResponse({ data }, 201);
}

/** The invitee accepts ({ accept: true }) or declines ({ accept: false }) their pending invitation. */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();
  if (!UUID.test(id)) return jsonError("invite_not_found", 404);
  const limited = await limitSharedWrites(user.id);
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  if (!body || typeof body.accept !== "boolean") return jsonError("missing_fields");

  const { data, error } = await supabase.rpc("respond_account_invite", { p_account: id, p_accept: body.accept });
  if (error) return rpcErrorResponse("accounts/members", error);
  notifyAfter(() => inviteAnsweredEvents(id, body.accept, user.id));
  return jsonResponse({ data });
}
