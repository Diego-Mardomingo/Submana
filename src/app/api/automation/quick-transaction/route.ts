import { createAdminClient } from "@/lib/supabase/admin";
import { jsonError, jsonResponse, parseRequestBody } from "@/lib/apiHelpers";
import { NextRequest } from "next/server";
import { createHash } from "crypto";

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

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

  const tokenHash = hashToken(token);
  const { data: tokenRow, error: tokenError } = await admin
    .from("api_tokens")
    .select("user_id")
    .eq("token_hash", tokenHash)
    .single();

  if (tokenError || !tokenRow) {
    return jsonError("Invalid or expired token", 401);
  }

  const userId = tokenRow.user_id as string;

  const { body } = await parseRequestBody(request);
  const amountRaw = body.amount;
  const description = body.description ?? null;
  const accountId = body.accountId ?? body.account_id ?? null;

  const amountNormalized = amountRaw !== "" && amountRaw != null ? String(amountRaw).replace(",", ".") : "";
  const amount = amountNormalized !== "" ? parseFloat(amountNormalized) : NaN;
  if (isNaN(amount)) {
    await logNotification(admin, userId, false, null, "Missing or invalid amount", amountRaw !== "" ? Number(amountRaw) : null, description, accountId);
    return jsonError("Missing or invalid amount", 400);
  }

  if (!accountId || accountId === "") {
    await logNotification(admin, userId, false, null, "Missing accountId", amount, description, null);
    return jsonError("Missing accountId", 400);
  }

  const { data: account, error: accountError } = await admin
    .from("accounts")
    .select("id, balance")
    .eq("id", accountId)
    .eq("user_id", userId)
    .single();

  if (accountError || !account) {
    await logNotification(admin, userId, false, null, "Account not found or access denied", amount, description, accountId);
    return jsonError("Account not found or access denied", 404);
  }

  const date = new Date().toISOString().slice(0, 10);
  const type = "expense";

  const { data: insertedData, error: insertError } = await admin
    .from("transactions")
    .insert({
      user_id: userId,
      amount,
      type,
      date,
      description: description || null,
      account_id: accountId,
    })
    .select()
    .single();

  if (insertError) {
    await logNotification(admin, userId, false, null, insertError.message, amount, description, accountId);
    return jsonError(insertError.message, 500);
  }

  const currentBalance = Number(account.balance);
  const newBalance = currentBalance - amount;
  await admin.from("accounts").update({ balance: newBalance }).eq("id", accountId);

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
