import { NextRequest } from "next/server";
import { adjustAccountBalance, jsonError, jsonResponse, parseRequestBody } from "@/lib/apiHelpers";
import { createAdminClient, hashToken } from "@/lib/supabase/admin";

/** Creates an expense from an automation (e.g. iOS Shortcut) authenticated with a Bearer token. */
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

  const { data: tokenRow } = await admin.from("api_tokens").select("user_id").eq("token_hash", hashToken(token)).single();
  if (!tokenRow) return jsonError("Invalid or expired token", 401);
  const userId = tokenRow.user_id as string;

  const body = await parseRequestBody(request);
  const description = body.description || null;
  const accountId = body.accountId || body.account_id || null;
  const amount = body.amount ? parseFloat(body.amount.replace(",", ".")) : NaN;

  const fail = async (message: string, status: number) => {
    await admin.from("automation_notifications").insert({
      user_id: userId,
      success: false,
      error_message: message,
      amount: isNaN(amount) ? null : amount,
      description,
      account_id: accountId,
    });
    return jsonError(message, status);
  };

  if (isNaN(amount)) return fail("Missing or invalid amount", 400);
  if (!accountId) return fail("Missing accountId", 400);

  const { data: account } = await admin.from("accounts").select("id").eq("id", accountId).eq("user_id", userId).single();
  if (!account) return fail("Account not found or access denied", 404);

  const { data, error } = await admin
    .from("transactions")
    .insert({ user_id: userId, amount, type: "expense", date: new Date().toISOString().slice(0, 10), description, account_id: accountId })
    .select()
    .single();
  if (error) return fail(error.message, 500);

  await adjustAccountBalance(admin, accountId, -amount);
  await admin.from("automation_notifications").insert({
    user_id: userId,
    success: true,
    transaction_id: data.id,
    amount,
    description,
    account_id: accountId,
  });
  return jsonResponse({ data }, 201);
}
