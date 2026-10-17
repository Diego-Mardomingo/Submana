import { NextRequest } from "next/server";
import { getAuthedClient, jsonError, jsonResponse, jsonServerError, unauthorized } from "@/lib/apiHelpers";
import { psuFrom, todayInApp } from "@/lib/banking/request";
import { syncConnection } from "@/lib/banking/sync";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Error code and HTTP status of each outcome other than "ok" (the app maps the codes to toasts). */
const FAILURES = {
  not_found: ["connection_not_found", 404],
  expired: ["bank_expired", 409],
  busy: ["sync_in_progress", 409],
  failed: ["sync_failed", 502],
} as const;

/**
 * "Sync now": syncs one of the user's connections while they are in the app. No notifications: the app
 * shows the outcome as toasts.
 */
export async function POST(request: NextRequest) {
  const { user } = await getAuthedClient();
  if (!user) return unauthorized();

  const limited = await enforceRateLimit(`banking:${user.id}`, RATE_LIMITS.banking.limit, RATE_LIMITS.banking.windowSeconds);
  if (limited) return limited;

  let body: { connection_id?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body");
  }
  if (!body.connection_id) return jsonError("missing connection_id");

  try {
    const outcome = await syncConnection(createAdminClient(), body.connection_id, { today: todayInApp(), psu: psuFrom(request), userId: user.id });
    if (outcome.status === "ok") return jsonResponse({ data: outcome.result });
    const [message, status] = FAILURES[outcome.status];
    return jsonError(message, status);
  } catch (error) {
    return jsonServerError("banking/sync", error);
  }
}
