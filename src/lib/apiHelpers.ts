import type { SupabaseClient } from "@supabase/supabase-js";
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

/**
 * Whether the account belongs to the user. Don't rely on RLS alone: ids come from the client
 * and are then used to move balances.
 */
export async function isOwnedAccount(supabase: SupabaseClient, userId: string, accountId: string) {
  const { data } = await supabase.from("accounts").select("id").eq("id", accountId).eq("user_id", userId).maybeSingle();
  return !!data;
}

/** True when every category is a system one (user_id null) or the user's. */
export async function areAccessibleCategories(
  supabase: SupabaseClient,
  userId: string,
  categoryIds: (string | null | undefined)[]
) {
  const unique = [...new Set(categoryIds.filter((id): id is string => !!id))];
  if (unique.length === 0) return true;
  const { data } = await supabase.from("categories").select("id").in("id", unique).or(`user_id.is.null,user_id.eq.${userId}`);
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
