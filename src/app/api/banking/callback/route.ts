import { NextRequest, NextResponse } from "next/server";
import { getAuthedClient } from "@/lib/apiHelpers";
import { completeConnection } from "@/lib/banking/connections";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * The bank sends the user back here with `code` + `state` (or `error`). The user must be signed in and the
 * state must belong to one of their pending connections. Always ends on an app page:
 *  - /account/{id}?bank=link&connection={id}: choose the Submana account of each bank account;
 *  - /account/{id}?bank=connected: every account kept its link (reconnection);
 *  - ?bank=error / ?bank=cancelled otherwise.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const go = (path: string) => {
    const response = NextResponse.redirect(new URL(path, request.url));
    response.headers.set("Cache-Control", "no-store");
    return response;
  };

  const { user } = await getAuthedClient();
  if (!user) return go("/login");

  const state = params.get("state");
  const code = params.get("code");
  const admin = createAdminClient();
  // Where to land if something goes wrong: the account the connection was started from.
  const origin = state
    ? (await admin.from("bank_connections").select("origin_account_id").eq("user_id", user.id).eq("pending_state", state).maybeSingle()).data?.origin_account_id
    : null;
  const base = origin ? `/account/${origin}` : "/accounts";

  if (!state || !code) {
    if (state) await admin.from("bank_connections").delete().eq("user_id", user.id).eq("pending_state", state).eq("status", "pending");
    // The bank answers with `error` when the user cancels or denies the consent.
    return go(`${base}?bank=${params.get("error") ? "cancelled" : "error"}`);
  }

  try {
    const done = await completeConnection(admin, { userId: user.id, state, code });
    if (!done) return go(`${base}?bank=error`);
    const target = done.originAccountId ? `/account/${done.originAccountId}` : "/accounts";
    return go(done.needsLinking ? `${target}?bank=link&connection=${done.connectionId}` : `${target}?bank=connected&connection=${done.connectionId}`);
  } catch (error) {
    console.error("[banking/callback]", error instanceof Error ? error.message : error);
    return go(`${base}?bank=error`);
  }
}
