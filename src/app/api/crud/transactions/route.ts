import { createClient } from "@/lib/supabase/server";
import {
  areAccessibleCategories,
  isOwnedAccount,
  jsonError,
  jsonResponse,
  jsonCachedResponse,
  jsonServerError,
  parseRequestBody,
} from "@/lib/apiHelpers";
import { calendarMonthsUtcHalfOpenRange } from "@/lib/date";
import { NextRequest } from "next/server";

const PAGE_SIZE = 1000;

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return jsonError("Unauthorized", 401);
  }

  const { searchParams } = new URL(request.url);
  const yearParam = searchParams.get("year");
  const monthParam = searchParams.get("month");
  const accountIdParam = searchParams.get("account_id");
  // "minimal": solo lo necesario para agregados (tendencias de saldo), sin joins.
  const minimal = searchParams.get("fields") === "minimal";

  let range: { startIso: string; endExclusiveIso: string } | null = null;
  if (yearParam) {
    const year = parseInt(yearParam, 10);
    const month = monthParam ? parseInt(monthParam, 10) : null; // 1-12 from client
    if (!Number.isInteger(year) || (month !== null && !(month >= 1 && month <= 12))) {
      return jsonError("invalid_period");
    }
    // Sin mes => año completo (antes devolvía todo el histórico).
    range = calendarMonthsUtcHalfOpenRange(year, month ?? 1, year, month ?? 12);
  }

  const buildQuery = () => {
    let query = supabase
      .from("transactions")
      .select(
        minimal
          ? "id, amount, type, date, account_id, category_id, subcategory_id"
          : `
      *,
      account:accounts(name, color),
      category:categories!category_id(name),
      subcategory:categories!subcategory_id(name)
    `
      )
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .order("id", { ascending: true });
    if (range) {
      query = query.gte("date", range.startIso).lt("date", range.endExclusiveIso);
    }
    if (accountIdParam) {
      query = query.eq("account_id", accountIdParam);
    }
    return query;
  };

  // PostgREST corta en 1000 filas: paginar para no truncar el histórico (saldos, tendencias).
  const transactions: unknown[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
    if (error) {
      return jsonServerError("GET /api/crud/transactions", error);
    }
    transactions.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }

  return jsonCachedResponse({ data: transactions });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return jsonError("Unauthorized", 401);
  }

  const { body } = await parseRequestBody(request);
  const amount = parseFloat(body.amount || "");
  const type = body.type;
  const date = body.date;
  const description = body.description;
  const account_id = body.account_id || null;
  const category_id = body.category_id && body.category_id !== "" ? body.category_id : null;
  const subcategory_id = body.subcategory_id && body.subcategory_id !== "" ? body.subcategory_id : null;

  if (!Number.isFinite(amount) || amount <= 0 || !date || !account_id) {
    return jsonError("missing_fields");
  }
  if (type !== "income" && type !== "expense") {
    return jsonError("invalid_type");
  }
  if (!(await isOwnedAccount(supabase, user.id, account_id))) {
    return jsonError("Account not found", 404);
  }
  if (!(await areAccessibleCategories(supabase, user.id, [category_id, subcategory_id]))) {
    return jsonError("invalid_category");
  }

  // Inserción y saldo en una sola transacción de Postgres.
  const { data: insertedData, error } = await supabase.rpc("create_transaction_with_balance", {
    p_user_id: user.id,
    p_account_id: account_id,
    p_amount: amount,
    p_type: type,
    p_date: date,
    p_description: description || null,
    p_category_id: category_id,
    p_subcategory_id: subcategory_id,
  });

  if (error) {
    return jsonServerError("POST /api/crud/transactions", error);
  }

  return jsonResponse({ data: insertedData }, 201);
}
