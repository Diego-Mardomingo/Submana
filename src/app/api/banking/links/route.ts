import { NextRequest } from "next/server";
import { getAccountAccess, getAuthedClient, jsonError, jsonResponse, jsonServerError, unauthorized } from "@/lib/apiHelpers";
import { createAdminClient } from "@/lib/supabase/admin";

type LinkInput = { id?: unknown; account_id?: unknown; sync_mode?: unknown; sync_from?: unknown };

const isDay = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));

/** Saves which Submana account each bank account feeds, what is synced and from which day. */
export async function PATCH(request: NextRequest) {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  let body: { links?: LinkInput[] };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body");
  }
  const links = Array.isArray(body.links) ? body.links : null;
  if (!links || links.length === 0 || links.length > 20) return jsonError("invalid_links");

  const updates: { id: string; account_id: string | null; sync_mode: "full" | "balance"; sync_from: string | null }[] = [];
  for (const link of links) {
    if (typeof link.id !== "string") return jsonError("invalid_links");
    const accountId = link.account_id == null || link.account_id === "" ? null : link.account_id;
    if (accountId !== null && typeof accountId !== "string") return jsonError("invalid_links");
    if (link.sync_mode !== "full" && link.sync_mode !== "balance") return jsonError("invalid_links");
    if (link.sync_from != null && !isDay(link.sync_from)) return jsonError("invalid_links");
    // Syncing movements needs a start day: earlier ones came from statements.
    if (accountId && link.sync_mode === "full" && link.sync_from == null) return jsonError("missing_sync_from");
    if (new Set(updates.map((u) => u.account_id).filter(Boolean)).has(accountId)) return jsonError("account_taken", 409);
    updates.push({ id: link.id, account_id: accountId, sync_mode: link.sync_mode, sync_from: (link.sync_from as string | null) ?? null });
  }

  // Accounts come from the client: they must be ones the user can write into.
  for (const accountId of new Set(updates.map((u) => u.account_id).filter((id): id is string => !!id))) {
    if (!(await getAccountAccess(supabase, user.id, accountId))) return jsonError("Account not found or access denied", 404);
  }

  const admin = createAdminClient();
  const { data: owned } = await admin.from("bank_account_links").select("id").eq("user_id", user.id).in("id", updates.map((u) => u.id));
  if ((owned?.length ?? 0) !== updates.length) return jsonError("link_not_found", 404);

  try {
    // Unlinked first, so an account can move from one bank account to another in the same save.
    const ordered = [...updates].sort((a, b) => Number(!!a.account_id) - Number(!!b.account_id));
    for (const { id, ...values } of ordered) {
      const { error } = await admin.from("bank_account_links").update(values).eq("id", id).eq("user_id", user.id);
      if (error?.code === "23505") return jsonError("account_taken", 409);
      if (error) throw error;
    }
    return jsonResponse({ data: { success: true } });
  } catch (error) {
    return jsonServerError("banking/links", error);
  }
}
