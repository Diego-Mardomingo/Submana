/**
 * Bank connections (server only, service-role client): the trip to the bank and back, and what the app
 * may see of them. Every query filters by the user: these tables have no RLS policies at all.
 */
import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSession, deleteSession, maxConsentSeconds, startAuthorization, type PsuHeaders } from "./enableBanking";
import { accountLast4 } from "./mapping";
import { BANK_ASPSPS, type BankConnectionView, type ConnectableProvider } from "./types";

/** PSD2 caps the consent at 180 days; a minute less avoids "longer than allowed" rejections. */
const MAX_CONSENT_SECONDS = 180 * 86_400;
/** Pending trips to the bank older than this are abandoned. */
const PENDING_TTL_MS = 60 * 60 * 1000;

const VIEW_COLUMNS = "id, aspsp_name, status, valid_until, last_synced_at, last_error, links:bank_account_links(id, account_id, iban_last4, currency, sync_mode, sync_from, last_synced_at)";

/** The user's connections (active or expired) as the app may see them. */
export async function listConnections(admin: SupabaseClient, userId: string): Promise<BankConnectionView[]> {
  const { data, error } = await admin
    .from("bank_connections")
    .select(VIEW_COLUMNS)
    .eq("user_id", userId)
    .in("status", ["active", "expired"])
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as BankConnectionView[];
}

/**
 * Creates a pending connection and returns the bank's authorisation URL. `state` ties the bank's answer
 * to this user and connection (it is checked again on the way back).
 */
export async function startConnection(
  admin: SupabaseClient,
  args: { userId: string; provider: ConnectableProvider; originAccountId: string; redirectUrl: string; psu?: PsuHeaders }
): Promise<string> {
  const aspsp = { name: BANK_ASPSPS[args.provider].name, country: BANK_ASPSPS[args.provider].country };
  await admin.from("bank_connections").delete().eq("user_id", args.userId).eq("status", "pending").lt("created_at", new Date(Date.now() - PENDING_TTL_MS).toISOString());

  const allowed = (await maxConsentSeconds(aspsp).catch(() => null)) ?? MAX_CONSENT_SECONDS;
  const validUntil = new Date(Date.now() + (Math.min(allowed, MAX_CONSENT_SECONDS) - 60) * 1000);
  const state = randomBytes(32).toString("hex");

  const { data: row, error } = await admin
    .from("bank_connections")
    .insert({ user_id: args.userId, aspsp_name: aspsp.name, aspsp_country: aspsp.country, status: "pending", pending_state: state, origin_account_id: args.originAccountId })
    .select("id")
    .single();
  if (error) throw error;

  try {
    const { url } = await startAuthorization({ aspsp, state, redirectUrl: args.redirectUrl, validUntil, psu: args.psu });
    return url;
  } catch (err) {
    await admin.from("bank_connections").delete().eq("id", row.id);
    throw err;
  }
}

/** Default mode of a link for a bank (Trade Republic: balance only). */
function defaultMode(aspspName: string) {
  return Object.values(BANK_ASPSPS).find((a) => a.name === aspspName)?.defaultMode ?? "full";
}

/**
 * Back from the bank: exchanges the code for a session, stores the authorised accounts and carries over the
 * links of older connections to the same accounts (reconnecting keeps the setup; the old session is closed).
 * Returns the connection and whether some account still has to be linked by the user.
 */
export async function completeConnection(admin: SupabaseClient, args: { userId: string; state: string; code: string }) {
  const { data: pending } = await admin
    .from("bank_connections")
    .select("id, aspsp_name, origin_account_id, created_at")
    .eq("user_id", args.userId)
    .eq("pending_state", args.state)
    .eq("status", "pending")
    .maybeSingle();
  if (!pending || Date.parse(pending.created_at) < Date.now() - PENDING_TTL_MS) return null;

  const session = await createSession(args.code);
  const { error } = await admin
    .from("bank_connections")
    .update({ status: "active", session_id: session.session_id, pending_state: null, valid_until: session.access?.valid_until ?? null })
    .eq("id", pending.id);
  if (error) {
    await deleteSession(session.session_id);
    throw error;
  }

  // Older connections of this user that cover any of these accounts are replaced by this one.
  const hashes = session.accounts.map((a) => a.identification_hash);
  const { data: previousLinks } = hashes.length
    ? await admin
        .from("bank_account_links")
        .select("connection_id, identification_hash, account_id, sync_mode, sync_from, last_synced_at")
        .eq("user_id", args.userId)
        .neq("connection_id", pending.id)
        .in("identification_hash", hashes)
    : { data: [] };
  const carried = new Map((previousLinks ?? []).map((l) => [l.identification_hash as string, l]));
  const replacedIds = [...new Set((previousLinks ?? []).map((l) => l.connection_id as string))];
  if (replacedIds.length > 0) {
    const { data: replaced } = await admin.from("bank_connections").select("id, session_id").in("id", replacedIds).eq("user_id", args.userId);
    for (const old of replaced ?? []) if (old.session_id) await deleteSession(old.session_id);
    // Cascades to their links, which frees the Submana accounts for the new links.
    await admin.from("bank_connections").delete().in("id", replacedIds).eq("user_id", args.userId);
  }

  const mode = defaultMode(pending.aspsp_name);
  const links = session.accounts.map((account) => {
    const previous = carried.get(account.identification_hash);
    return {
      connection_id: pending.id,
      user_id: args.userId,
      bank_account_uid: account.uid,
      identification_hash: account.identification_hash,
      iban_last4: accountLast4(account),
      currency: account.currency ?? null,
      account_id: previous?.account_id ?? null,
      sync_mode: previous?.sync_mode ?? mode,
      sync_from: previous?.sync_from ?? null,
      last_synced_at: previous?.last_synced_at ?? null,
    };
  });
  if (links.length > 0) {
    const { error: linkError } = await admin.from("bank_account_links").insert(links);
    if (linkError) throw linkError;
  }

  return { connectionId: pending.id as string, originAccountId: pending.origin_account_id as string | null, needsLinking: links.some((l) => !l.account_id) };
}

/** Closes the bank session and forgets the connection (imported movements stay). False when it isn't the user's. */
export async function removeConnection(admin: SupabaseClient, userId: string, connectionId: string) {
  const { data } = await admin.from("bank_connections").select("id, session_id").eq("id", connectionId).eq("user_id", userId).maybeSingle();
  if (!data) return false;
  if (data.session_id) await deleteSession(data.session_id);
  const { error } = await admin.from("bank_connections").delete().eq("id", connectionId).eq("user_id", userId);
  if (error) throw error;
  return true;
}
