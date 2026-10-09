import { getAuthedClient, jsonError, jsonResponse, jsonServerError, unauthorized } from "@/lib/apiHelpers";
import { notify } from "@/lib/notifications/server";
import { isPushConfigured } from "@/lib/notifications/push";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rateLimit";

/** Sends a test push to the current user's devices (awaited, so the profile can report the result). */
export async function POST() {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();
  const limited = await enforceRateLimit(`push-test:${user.id}`, RATE_LIMITS.pushTest.limit, RATE_LIMITS.pushTest.windowSeconds);
  if (limited) return limited;

  if (!isPushConfigured()) return jsonError("push_not_configured", 503);
  const { count, error } = await supabase.from("push_subscriptions").select("id", { count: "exact", head: true });
  if (error) return jsonServerError("push/test", error);
  if (!count) return jsonError("no_push_subscriptions", 409);

  await notify([{ userId: user.id, type: "system.push_test", params: {} }]);
  return jsonResponse({ data: { devices: count } });
}
