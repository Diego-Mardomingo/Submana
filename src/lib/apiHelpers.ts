import type { SupabaseClient } from "@supabase/supabase-js";
import type { AccountRole } from "@/lib/accountAccess";
import { createClient } from "@/lib/supabase/server";

/** Parses a JSON or form-data body into string values (automation clients may post forms). */
export async function parseRequestBody(request: Request): Promise<Record<string, string>> {
  const entries = (request.headers.get("content-type") ?? "").includes("application/json")
    ? Object.entries((await request.json()) as Record<string, unknown>)
    : [...(await request.formData()).entries()];
  return Object.fromEntries(entries.map(([key, value]) => [key, value == null ? "" : String(value)]));
}

export function jsonResponse(data: unknown, status = 200) {
  return Response.json(data, { status });
}

/**
 * Mutable user data: the browser must always revalidate (the cache lives in React Query).
 * With max-age, a refetch right after a mutation could get the stale response.
 */
export function jsonCachedResponse(data: unknown) {
  return Response.json(data, { headers: { "Cache-Control": "private, no-cache" } });
}

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export const unauthorized = () => jsonError("Unauthorized", 401);

/**
 * Generic 500: the details (Postgres/PostgREST messages with table and constraint names)
 * are logged on the server and never sent to the client.
 */
export function jsonServerError(context: string, error: unknown) {
  console.error(`[${context}]`, error);
  return jsonError("internal_error", 500);
}

/** Supabase client bound to the request cookies plus the authenticated user (null when signed out). */
export async function getAuthedClient() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user };
}

export type AccountAccess = { role: AccountRole; isJoint: boolean };

/**
 * The user's access to an account: owner, accepted member of a joint account, or null. Don't rely on
 * RLS alone: ids come from the client and are then used to move balances (and service-role paths
 * have no RLS at all).
 */
export async function getAccountAccess(supabase: SupabaseClient, userId: string, accountId: string): Promise<AccountAccess | null> {
  const { data: account } = await supabase.from("accounts").select("user_id, is_joint").eq("id", accountId).maybeSingle();
  if (!account) return null;
  const isJoint = !!account.is_joint;
  if (account.user_id === userId) return { role: "owner", isJoint };
  if (!isJoint) return null;
  const { data: member } = await supabase
    .from("account_members")
    .select("user_id")
    .eq("account_id", accountId)
    .eq("user_id", userId)
    .eq("status", "accepted")
    .maybeSingle();
  return member ? { role: "member", isJoint } : null;
}

/** True when every category is a system one (user_id null) or, unless `systemOnly`, the user's. */
export async function areAccessibleCategories(
  supabase: SupabaseClient,
  userId: string,
  categoryIds: (string | null | undefined)[],
  options: { systemOnly?: boolean } = {}
) {
  const unique = [...new Set(categoryIds.filter((id): id is string => !!id))];
  if (unique.length === 0) return true;
  const query = supabase.from("categories").select("id").in("id", unique);
  const { data } = await (options.systemOnly ? query.is("user_id", null) : query.or(`user_id.is.null,user_id.eq.${userId}`));
  return (data?.length ?? 0) === unique.length;
}

/** Signed effect of a transaction on its account balance. */
export function signedAmount(tx: { type: string; amount: number | string }) {
  return tx.type === "income" ? Number(tx.amount) : -Number(tx.amount);
}

/** Atomically adds `delta` to the user's account balance; returns the new balance (null when unchanged/not found). */
export async function adjustAccountBalance(
  supabase: SupabaseClient,
  userId: string,
  accountId: string | null | undefined,
  delta: number
): Promise<number | null> {
  if (!accountId || !delta) return null;
  const { data } = await supabase.rpc("adjust_account_balance", { p_account_id: accountId, p_user_id: userId, p_delta: delta });
  return data != null ? Number(data) : null;
}

/** Runs `query` over `items` in chunks (keeps `.in()` URLs short) and concatenates the rows. */
export async function inChunks<T, R>(items: T[], size: number, query: (chunk: T[]) => PromiseLike<{ data: R[] | null }>) {
  const rows: R[] = [];
  for (let i = 0; i < items.length; i += size) rows.push(...((await query(items.slice(i, i + size))).data ?? []));
  return rows;
}

const PAGE_SIZE = 1000;

/** Reads every page of a query (PostgREST caps responses at 1000 rows); `page` must apply a stable order. */
export async function fetchAllPages<R>(page: (from: number, to: number) => PromiseLike<{ data: R[] | null; error: unknown }>) {
  const rows: R[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

/** Shared create/update payload parsing (empty strings mean "none"). */
export function readTransactionInput(body: Record<string, string>) {
  return {
    amount: parseFloat(body.amount || ""),
    type: body.type,
    date: body.date,
    description: body.description || null,
    account_id: body.account_id || null,
    category_id: body.category_id || null,
    subcategory_id: body.subcategory_id || null,
  };
}

/** Ids of every account the user can use: the ones they own plus joint accounts they accepted. */
export async function listAccessibleAccounts(supabase: SupabaseClient, userId: string) {
  const [{ data: owned }, { data: memberships }] = await Promise.all([
    supabase.from("accounts").select("id, is_joint").eq("user_id", userId),
    supabase.from("account_members").select("account_id").eq("user_id", userId).eq("status", "accepted"),
  ]);
  const ids = new Set<string>((owned ?? []).map((a) => a.id as string));
  const jointIds = new Set<string>((owned ?? []).filter((a) => a.is_joint).map((a) => a.id as string));
  for (const m of memberships ?? []) {
    ids.add(m.account_id as string);
    jointIds.add(m.account_id as string);
  }
  return { ids: [...ids], jointIds: [...jointIds] };
}
