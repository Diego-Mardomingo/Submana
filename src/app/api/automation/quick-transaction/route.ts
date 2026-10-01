import { createAdminClient } from "@/lib/supabase/admin";
import { jsonError, jsonResponse, jsonServerError, parseRequestBody } from "@/lib/apiHelpers";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import { NextRequest } from "next/server";
import { createHash } from "crypto";

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function clientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

/**
 * Crea un gasto desde automatizaciones (Atajos, etc.) autenticando con token Bearer.
 * Usa service role (sin RLS): toda autorización se hace aquí filtrando por el user_id del token.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (!token) {
    return jsonError("Missing or invalid Authorization header (Bearer token required)", 401);
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server configuration error";
    const isDev = process.env.NODE_ENV === "development";
    return jsonError(
      isDev ? `${msg}. Add SUPABASE_SERVICE_ROLE_KEY to .env.local (Supabase Dashboard → Settings → API → service_role key).` : "Server configuration error",
      500
    );
  }

  const { data: tokenRow } = await admin
    .from("api_tokens")
    .select("id, user_id")
    .eq("token_hash", hashToken(token))
    .maybeSingle();

  if (!tokenRow) {
    const limited = await enforceRateLimit(
      `automation-auth-fail:${clientIp(request)}`,
      RATE_LIMITS.automationAuthFailure.limit,
      RATE_LIMITS.automationAuthFailure.windowSeconds
    );
    if (limited) return limited;
    return jsonError("Invalid or expired token", 401);
  }

  const userId = tokenRow.user_id as string;

  const limited = await enforceRateLimit(
    `automation:${userId}`,
    RATE_LIMITS.automation.limit,
    RATE_LIMITS.automation.windowSeconds
  );
  if (limited) return limited;

  await admin.from("api_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", tokenRow.id);

  const { body } = await parseRequestBody(request);
  const amountRaw = body.amount;
  const description = body.description ? String(body.description).slice(0, 500) : null;
  const accountId = body.accountId ?? body.account_id ?? null;

  const amountNormalized = amountRaw !== "" && amountRaw != null ? String(amountRaw).replace(",", ".") : "";
  const amount = amountNormalized !== "" ? parseFloat(amountNormalized) : NaN;
  if (!Number.isFinite(amount) || amount <= 0) {
    await logNotification(admin, userId, false, null, "Missing or invalid amount", null, description, null);
    return jsonError("Missing or invalid amount", 400);
  }

  if (!accountId) {
    await logNotification(admin, userId, false, null, "Missing accountId", amount, description, null);
    return jsonError("Missing accountId", 400);
  }

  const { data: account } = await admin
    .from("accounts")
    .select("id")
    .eq("id", accountId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!account) {
    await logNotification(admin, userId, false, null, "Account not found or access denied", amount, description, null);
    return jsonError("Account not found or access denied", 404);
  }

  // Instante completo: el día UTC (toISOString().slice(0, 10)) caía en el día anterior
  // para gastos hechos entre las 00:00 y las 02:00 en Madrid.
  const { data: insertedData, error: insertError } = await admin.rpc("create_transaction_with_balance", {
    p_user_id: userId,
    p_account_id: accountId,
    p_amount: amount,
    p_type: "expense",
    p_date: new Date().toISOString(),
    p_description: description,
  });

  if (insertError || !insertedData?.id) {
    await logNotification(admin, userId, false, null, "Could not create transaction", amount, description, accountId);
    return jsonServerError("automation/quick-transaction", insertError);
  }

  await logNotification(admin, userId, true, insertedData.id, null, amount, description, accountId);

  return jsonResponse({ data: insertedData }, 201);
}

async function logNotification(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  success: boolean,
  transactionId: string | null,
  errorMessage: string | null,
  amount: number | null,
  description: string | null,
  accountId: string | null
) {
  await admin.from("automation_notifications").insert({
    user_id: userId,
    success,
    transaction_id: transactionId,
    error_message: errorMessage,
    amount: amount ?? null,
    description: description ?? null,
    account_id: accountId,
  });
}
