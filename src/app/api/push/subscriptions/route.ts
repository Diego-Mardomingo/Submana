import { NextRequest } from "next/server";
import { getAuthedClient, jsonError, jsonResponse, jsonServerError, unauthorized } from "@/lib/apiHelpers";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_ENDPOINT = 2048;
const MAX_KEY = 256;

/** A push service endpoint: always https (a plain-text URL would leak the payload route). */
function parseEndpoint(value: unknown) {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_ENDPOINT) return null;
  try {
    return new URL(value).protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}

const parseKey = (value: unknown) => (typeof value === "string" && value.length > 0 && value.length <= MAX_KEY ? value : null);

/**
 * Registers this device's push subscription for the current user. `endpoint` is unique across users: the
 * same browser may have been signed in as someone else, and RLS cannot see their row, so the upsert goes
 * through the service role (after authenticating) and reassigns the row to the current user.
 */
export async function POST(request: NextRequest) {
  const { user } = await getAuthedClient();
  if (!user) return unauthorized();

  const body = await request.json().catch(() => null);
  const endpoint = parseEndpoint(body?.endpoint);
  const p256dh = parseKey(body?.keys?.p256dh);
  const auth = parseKey(body?.keys?.auth);
  if (!endpoint || !p256dh || !auth) return jsonError("invalid_subscription");

  const { error } = await createAdminClient()
    .from("push_subscriptions")
    .upsert(
      { user_id: user.id, endpoint, p256dh, auth, user_agent: request.headers.get("user-agent")?.slice(0, 300) ?? null },
      { onConflict: "endpoint" }
    );
  if (error) return jsonServerError("push/subscriptions", error);
  return jsonResponse({ data: { ok: true } });
}

/** Removes this device's subscription (own rows only: RLS). */
export async function DELETE(request: NextRequest) {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const body = await request.json().catch(() => null);
  const endpoint = parseEndpoint(body?.endpoint);
  if (!endpoint) return jsonError("invalid_subscription");

  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", user.id);
  if (error) return jsonServerError("push/subscriptions", error);
  return jsonResponse({ data: { ok: true } });
}
