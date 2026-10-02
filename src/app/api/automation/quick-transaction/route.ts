import { NextRequest } from "next/server";
import { jsonError, jsonResponse, jsonServerError, parseRequestBody } from "@/lib/apiHelpers";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import { createAdminClient, hashToken } from "@/lib/supabase/admin";

const clientIp = (request: NextRequest) => request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

/**
 * Creates an expense from an automation (e.g. iOS Shortcut) authenticated with a Bearer token.
 * Uses the service role (no RLS): every check filters by the token's user_id.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (!token) return jsonError("Missing or invalid Authorization header (Bearer token required)", 401);

  let admin;
  try {
    admin = createAdminClient();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server configuration error";
    return jsonError(
      process.env.NODE_ENV === "development"
        ? `${msg}. Add SUPABASE_SERVICE_ROLE_KEY to .env.local (Supabase Dashboard → Settings → API → service_role key).`
        : "Server configuration error",
      500
    );
  }

  const { data: tokenRow } = await admin.from("api_tokens").select("id, user_id").eq("token_hash", hashToken(token)).maybeSingle();
  if (!tokenRow) {
    const { limit, windowSeconds } = RATE_LIMITS.automationAuthFailure;
    return (await enforceRateLimit(`automation-auth-fail:${clientIp(request)}`, limit, windowSeconds)) ?? jsonError("Invalid or expired token", 401);
  }
  const userId = tokenRow.user_id as string;

  const limited = await enforceRateLimit(`automation:${userId}`, RATE_LIMITS.automation.limit, RATE_LIMITS.automation.windowSeconds);
  if (limited) return limited;
  await admin.from("api_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", tokenRow.id);

  const body = await parseRequestBody(request);
  const description = body.description ? body.description.slice(0, 500) : null;
  const accountId = body.accountId || body.account_id || null;
  const amount = body.amount ? parseFloat(body.amount.replace(",", ".")) : NaN;

  const notify = (fields: { success: boolean; error_message?: string; transaction_id?: string; account_id?: string | null }) =>
    admin.from("automation_notifications").insert({
      user_id: userId,
      amount: Number.isFinite(amount) ? amount : null,
      description,
      account_id: null,
      ...fields,
    });
  const fail = async (message: string, status: number) => {
    await notify({ success: false, error_message: message });
    return jsonError(message, status);
  };

  if (!Number.isFinite(amount) || amount <= 0) return fail("Missing or invalid amount", 400);
  if (!accountId) return fail("Missing accountId", 400);

  const { data: account } = await admin.from("accounts").select("id").eq("id", accountId).eq("user_id", userId).maybeSingle();
  if (!account) return fail("Account not found or access denied", 404);

  // Full instant: the UTC day (toISOString().slice(0, 10)) fell on the previous day for
  // expenses made between 00:00 and 02:00 in Madrid. The RPC also updates the balance atomically.
  const { data, error } = await admin.rpc("create_transaction_with_balance", {
    p_user_id: userId,
    p_account_id: accountId,
    p_amount: amount,
    p_type: "expense",
    p_date: new Date().toISOString(),
    p_description: description,
  });
  if (error || !data?.id) {
    await notify({ success: false, error_message: "Could not create transaction", account_id: accountId });
    return jsonServerError("automation/quick-transaction", error);
  }

  await notify({ success: true, transaction_id: data.id, account_id: accountId });
  return jsonResponse({ data }, 201);
}
