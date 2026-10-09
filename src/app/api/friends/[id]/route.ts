import { NextRequest } from "next/server";
import { getAuthedClient, jsonError, jsonResponse, jsonServerError, unauthorized } from "@/lib/apiHelpers";
import { friendRequestAcceptedEvents, type FriendshipRow } from "@/lib/notifications/events/friends";
import { notifyAfter } from "@/lib/notifications/server";

type Params = { params: Promise<{ id: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Accept or decline an incoming request. */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();
  if (!UUID.test(id)) return jsonError("request_not_found", 404);

  const body = await request.json().catch(() => null);
  if (!body || typeof body.accept !== "boolean") return jsonError("Invalid JSON body");

  const { data, error } = await supabase.rpc("respond_friend_request", { p_id: id, p_accept: body.accept });
  if (error) {
    if (error.message === "request_not_found") return jsonError(error.message, 404);
    if (error.message === "request_not_pending") return jsonError(error.message, 409);
    return jsonServerError("friends/[id]", error);
  }
  // Declining notifies nobody (the RPC returns the deleted row, still pending).
  if (body.accept) notifyAfter(() => friendRequestAcceptedEvents(data as FriendshipRow, user.id));
  return jsonResponse({ data });
}

/** Cancel an outgoing request or remove a friend (RLS limits it to either party). */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();
  if (!UUID.test(id)) return jsonError("request_not_found", 404);

  const { data, error } = await supabase.from("friendships").delete().eq("id", id).select("id");
  if (error) return jsonServerError("friends/[id]", error);
  if (!data?.length) return jsonError("request_not_found", 404);
  return jsonResponse({ data: { id } });
}
