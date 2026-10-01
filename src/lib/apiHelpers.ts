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

export function jsonCachedResponse(data: unknown, maxAge: number, staleWhileRevalidate: number) {
  return Response.json(data, {
    headers: { "Cache-Control": `private, max-age=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}` },
  });
}

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export const unauthorized = () => jsonError("Unauthorized", 401);

/** Supabase client bound to the request cookies plus the authenticated user (null when signed out). */
export async function getAuthedClient() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user };
}

/** Signed effect of a transaction on its account balance. */
export function signedAmount(tx: { type: string; amount: number | string }) {
  return tx.type === "income" ? Number(tx.amount) : -Number(tx.amount);
}

export async function adjustAccountBalance(supabase: SupabaseClient, accountId: string | null | undefined, delta: number) {
  if (!accountId || !delta) return;
  const { data } = await supabase.from("accounts").select("balance").eq("id", accountId).single();
  if (data) await supabase.from("accounts").update({ balance: Number(data.balance) + delta }).eq("id", accountId);
}

/** Runs `query` over `items` in chunks (keeps `.in()` URLs short) and concatenates the rows. */
export async function inChunks<T, R>(items: T[], size: number, query: (chunk: T[]) => PromiseLike<{ data: R[] | null }>) {
  const rows: R[] = [];
  for (let i = 0; i < items.length; i += size) rows.push(...((await query(items.slice(i, i + size))).data ?? []));
  return rows;
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
