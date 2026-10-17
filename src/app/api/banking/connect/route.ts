import { NextRequest } from "next/server";
import { getAccountAccess, getAuthedClient, jsonError, jsonResponse, jsonServerError, unauthorized } from "@/lib/apiHelpers";
import { startConnection } from "@/lib/banking/connections";
import { isBankingConfigured } from "@/lib/banking/enableBanking";
import { callbackUrl, psuFrom } from "@/lib/banking/request";
import { isConnectableProvider } from "@/lib/banking/types";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import { createAdminClient } from "@/lib/supabase/admin";

/** Starts connecting the bank of an account: returns the URL of the bank's authorisation page. */
export async function POST(request: NextRequest) {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();
  if (!isBankingConfigured()) return jsonError("banking_not_configured", 503);

  const limited = await enforceRateLimit(`banking:${user.id}`, RATE_LIMITS.banking.limit, RATE_LIMITS.banking.windowSeconds);
  if (limited) return limited;

  let body: { account_id?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body");
  }
  if (!body.account_id) return jsonError("missing account_id");
  if (!(await getAccountAccess(supabase, user.id, body.account_id))) return jsonError("Account not found or access denied", 404);

  const { data: account } = await supabase.from("accounts").select("bank_provider").eq("id", body.account_id).maybeSingle();
  const provider = account?.bank_provider;
  if (!isConnectableProvider(provider)) return jsonError("bank_not_supported");

  try {
    const url = await startConnection(createAdminClient(), {
      userId: user.id,
      provider,
      originAccountId: body.account_id,
      redirectUrl: callbackUrl(request),
      psu: psuFrom(request),
    });
    return jsonResponse({ data: { url } });
  } catch (error) {
    return jsonServerError("banking/connect", error);
  }
}
