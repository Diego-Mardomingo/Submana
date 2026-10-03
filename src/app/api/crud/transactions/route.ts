import { NextRequest } from "next/server";
import {
  areAccessibleCategories,
  fetchAllPages,
  getAuthedClient,
  isOwnedAccount,
  jsonCachedResponse,
  jsonError,
  jsonResponse,
  jsonServerError,
  parseRequestBody,
  readTransactionInput,
  unauthorized,
} from "@/lib/apiHelpers";
import { calendarMonthsUtcHalfOpenRange } from "@/lib/date";
import { fetchProfiles } from "@/lib/shared/server";
import type { SupabaseClient } from "@supabase/supabase-js";

type WithSharedExpense = { shared_expense?: { paid_by: string; paid_by_handle?: string | null } | null };

/** Adds the payer's @handle to the embedded shared expense when somebody else paid ("Paid by @ana"). */
async function withPayerHandles<T>(supabase: SupabaseClient, userId: string, rows: T[]): Promise<T[]> {
  const payers = new Set<string>();
  for (const row of rows as WithSharedExpense[]) if (row.shared_expense && row.shared_expense.paid_by !== userId) payers.add(row.shared_expense.paid_by);
  if (payers.size === 0) return rows;
  const profiles = await fetchProfiles(supabase, [...payers]);
  for (const row of rows as WithSharedExpense[]) {
    if (row.shared_expense) row.shared_expense.paid_by_handle = profiles.get(row.shared_expense.paid_by)?.handle ?? null;
  }
  return rows;
}

export async function GET(request: NextRequest) {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const params = request.nextUrl.searchParams;
  const accountId = params.get("account_id");
  // "minimal": only what aggregates (balance trends) need, without joins.
  const minimal = params.get("fields") === "minimal";

  let range: { startIso: string; endExclusiveIso: string } | undefined;
  if (params.get("year")) {
    const year = parseInt(params.get("year")!, 10);
    const month = params.get("month") ? parseInt(params.get("month")!, 10) : null; // 1-12
    if (!Number.isInteger(year) || (month !== null && !(month >= 1 && month <= 12))) return jsonError("invalid_period");
    // Without a month: the whole year.
    range = calendarMonthsUtcHalfOpenRange(year, month ?? 1, year, month ?? 12);
  }

  try {
    // PostgREST caps responses at 1000 rows: paginate so the history (balances, trends) isn't truncated.
    const data = await fetchAllPages((from, to) => {
      let query = supabase
        .from("transactions")
        .select(
          minimal
            ? "id, amount, type, date, account_id, category_id, subcategory_id, source, booked_at, metric_amount, shared_expense_id"
            : "*, account:accounts(name, color), category:categories!category_id(name), subcategory:categories!subcategory_id(name), shared_expense:shared_expenses!shared_expense_id(id, group_id, kind, title, total_amount, paid_by, split_mode)"
        )
        .eq("user_id", user.id)
        .order("date", { ascending: false })
        .order("id", { ascending: true });
      if (range) query = query.gte("date", range.startIso).lt("date", range.endExclusiveIso);
      if (accountId) query = query.eq("account_id", accountId);
      return query.range(from, to);
    });
    return jsonCachedResponse({ data: minimal ? data : await withPayerHandles(supabase, user.id, data) });
  } catch (error) {
    return jsonServerError("crud/transactions", error);
  }
}

export async function POST(request: NextRequest) {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const tx = readTransactionInput(await parseRequestBody(request));
  if (!Number.isFinite(tx.amount) || tx.amount <= 0 || !tx.date || !tx.account_id) return jsonError("missing_fields");
  if (tx.type !== "income" && tx.type !== "expense") return jsonError("invalid_type");
  if (!(await isOwnedAccount(supabase, user.id, tx.account_id))) return jsonError("Account not found", 404);
  if (!(await areAccessibleCategories(supabase, user.id, [tx.category_id, tx.subcategory_id]))) return jsonError("invalid_category");

  // Insert and balance update in a single Postgres transaction.
  const { data, error } = await supabase.rpc("create_transaction_with_balance", {
    p_user_id: user.id,
    p_account_id: tx.account_id,
    p_amount: tx.amount,
    p_type: tx.type,
    p_date: tx.date,
    p_description: tx.description,
    p_category_id: tx.category_id,
    p_subcategory_id: tx.subcategory_id,
    p_source: "manual",
  });
  if (error) return jsonServerError("crud/transactions", error);
  return jsonResponse({ data }, 201);
}
