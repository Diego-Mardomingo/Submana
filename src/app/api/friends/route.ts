import { NextRequest } from "next/server";
import { getAuthedClient, jsonCachedResponse, jsonError, jsonResponse, jsonServerError, unauthorized } from "@/lib/apiHelpers";
import { normalizeHandle, validateHandle } from "@/lib/handles";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rateLimit";

type FriendshipRow = { id: string; requester_id: string; addressee_id: string; status: "pending" | "accepted"; created_at: string };

/** Friends, incoming and outgoing requests; each item carries the friendship id and the other user's profile. */
export async function GET() {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const { data: rows, error } = await supabase
    .from("friendships")
    .select("id, requester_id, addressee_id, status, created_at")
    .order("created_at", { ascending: false });
  if (error) return jsonServerError("friends", error);

  const friendships = (rows ?? []) as FriendshipRow[];
  const otherId = (f: FriendshipRow) => (f.requester_id === user.id ? f.addressee_id : f.requester_id);
  const otherIds = [...new Set(friendships.map(otherId))];
  const { data: profiles, error: profilesError } = otherIds.length
    ? await supabase.from("profiles").select("user_id, handle, display_name, avatar_url").in("user_id", otherIds)
    : { data: [], error: null };
  if (profilesError) return jsonServerError("friends", profilesError);

  const byId = new Map((profiles ?? []).map((p) => [p.user_id as string, p]));
  const toItems = (list: FriendshipRow[]) =>
    list.flatMap((f) => {
      const profile = byId.get(otherId(f));
      return profile ? [{ id: f.id, created_at: f.created_at, profile }] : [];
    });

  return jsonCachedResponse({
    data: {
      friends: toItems(friendships.filter((f) => f.status === "accepted")),
      incoming: toItems(friendships.filter((f) => f.status === "pending" && f.addressee_id === user.id)),
      outgoing: toItems(friendships.filter((f) => f.status === "pending" && f.requester_id === user.id)),
    },
  });
}

const RPC_ERRORS: Record<string, number> = {
  handle_not_found: 404,
  cannot_friend_self: 400,
  profile_required: 409,
};

/** Send a friend request by @handle (accepts the reverse pending request if there is one). */
export async function POST(request: NextRequest) {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();
  const limited = await enforceRateLimit(`friends:${user.id}`, RATE_LIMITS.friends.limit, RATE_LIMITS.friends.windowSeconds);
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return jsonError("Invalid JSON body");
  const handle = normalizeHandle(String(body.handle ?? ""));
  if (validateHandle(handle) === "handle_invalid") return jsonError("handle_invalid");

  const { data, error } = await supabase.rpc("send_friend_request", { p_handle: handle });
  if (error) {
    const status = RPC_ERRORS[error.message];
    if (status) return jsonError(error.message, status);
    return jsonServerError("friends", error);
  }
  return jsonResponse({ data });
}
