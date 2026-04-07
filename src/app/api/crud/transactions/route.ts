import { createClient } from "@/lib/supabase/server";
import { jsonError, jsonResponse, jsonCachedResponse, parseRequestBody } from "@/lib/apiHelpers";
import { calendarMonthsUtcHalfOpenRange } from "@/lib/date";
import { NextRequest } from "next/server";

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

  let query = supabase
    .from("transactions")
    .select(
      `
      *,
      account:accounts(name, color),
      category:categories!category_id(name),
      subcategory:categories!subcategory_id(name)
    `
    )
    .eq("user_id", user.id)
    .order("date", { ascending: false });

  if (yearParam && monthParam) {
    const year = parseInt(yearParam, 10);
    const month = parseInt(monthParam, 10); // 1-12 from client
    const { startIso, endExclusiveIso } = calendarMonthsUtcHalfOpenRange(
      year,
      month,
      year,
      month
    );
    query = query.gte("date", startIso).lt("date", endExclusiveIso);
  }

  if (accountIdParam) {
    query = query.eq("account_id", accountIdParam);
  }

  const { data: transactions, error } = await query;

  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonCachedResponse({ data: transactions }, 200, 30, 120);
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

  if (isNaN(amount) || !type || !date) {
    return jsonError("missing_fields");
  }

  const { data: insertedData, error } = await supabase
    .from("transactions")
    .insert({
      user_id: user.id,
      amount,
      type,
      date,
      description: description || null,
      account_id: account_id && account_id !== "" ? account_id : null,
      category_id,
      subcategory_id,
    })
    .select()
    .single();

  if (error) {
    return jsonError(error.message, 500);
  }

  if (account_id && account_id !== "") {
    const { data: account } = await supabase
      .from("accounts")
      .select("balance")
      .eq("id", account_id)
      .single();
    if (account) {
      let newBalance = Number(account.balance);
      if (type === "income") newBalance += amount;
      else newBalance -= amount;
      await supabase
        .from("accounts")
        .update({ balance: newBalance })
        .eq("id", account_id);
    }
  }

  return jsonResponse({ data: insertedData }, 201);
}
