import { createClient } from "@/lib/supabase/server";
import { jsonError, jsonResponse, parseRequestBody } from "@/lib/apiHelpers";
import { NextRequest } from "next/server";
import { computeBudgetSpent, type CategoryRow } from "@/lib/budgetHelpers";

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
  const monthParam = searchParams.get("month"); // YYYY-MM
  const now = new Date();
  const year = monthParam ? parseInt(monthParam.slice(0, 4), 10) : now.getFullYear();
  const month = monthParam ? parseInt(monthParam.slice(5, 7), 10) : now.getMonth() + 1;

  const { data: budgets, error: budgetsError } = await supabase
    .from("budgets")
    .select("id, user_id, name, amount, color, created_at, updated_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (budgetsError) {
    return jsonError(budgetsError.message, 500);
  }

  const list = budgets ?? [];
  if (list.length === 0) {
    return jsonResponse({ data: [] });
  }

  const budgetIds = list.map((b) => b.id);
  const { data: budgetCats } = await supabase
    .from("budget_categories")
    .select("budget_id, category_id")
    .in("budget_id", budgetIds);

  const categoriesByBudget = new Map<string, string[]>();
  for (const row of budgetCats ?? []) {
    const arr = categoriesByBudget.get(row.budget_id) ?? [];
    arr.push(row.category_id);
    categoriesByBudget.set(row.budget_id, arr);
  }

  const { data: categoriesRows } = await supabase
    .from("categories")
    .select("id, parent_id")
    .or("user_id.eq." + user.id + ",user_id.is.null");
  const allCategories: CategoryRow[] = categoriesRows ?? [];

  const result = await Promise.all(
    list.map(async (budget) => {
      const categoryIds = categoriesByBudget.get(budget.id) ?? [];
      const spent = await computeBudgetSpent(
        supabase,
        user.id,
        categoryIds,
        allCategories,
        year,
        month
      );
      return {
        ...budget,
        amount: Number(budget.amount),
        categoryIds,
        spent,
      };
    })
  );

  return jsonResponse({ data: result });
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

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonError("Invalid JSON body");
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const amount =
    typeof body.amount === "number"
      ? body.amount
      : parseFloat(String(body.amount ?? ""));
  const color =
    typeof body.color === "string" && body.color ? body.color : null;
  let categoryIds: string[] = [];
  if (Array.isArray(body.category_ids)) {
    categoryIds = body.category_ids.filter((id): id is string => typeof id === "string");
  } else if (typeof body.category_ids === "string" && body.category_ids) {
    try {
      const parsed = JSON.parse(body.category_ids) as unknown;
      categoryIds = Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
    } catch {
      // ignore
    }
  }

  if (!name || isNaN(amount) || amount < 0) {
    return jsonError("missing_fields");
  }

  const { data: inserted, error: insertError } = await supabase
    .from("budgets")
    .insert({
      user_id: user.id,
      name,
      amount,
      color,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (insertError) {
    return jsonError(insertError.message, 500);
  }

  if (categoryIds.length > 0) {
    const rows = categoryIds.map((category_id) => ({
      budget_id: inserted.id,
      category_id,
    }));
    const { error: relError } = await supabase.from("budget_categories").insert(rows);
    if (relError) {
      await supabase.from("budgets").delete().eq("id", inserted.id);
      return jsonError(relError.message, 500);
    }
  }

  const categoryIdsForSpent = categoryIds;
  const now = new Date();
  const { data: categoriesRows } = await supabase
    .from("categories")
    .select("id, parent_id")
    .or("user_id.eq." + user.id + ",user_id.is.null");
  const allCategories: CategoryRow[] = categoriesRows ?? [];
  const spent = await computeBudgetSpent(
    supabase,
    user.id,
    categoryIdsForSpent,
    allCategories,
    now.getFullYear(),
    now.getMonth() + 1
  );

  return jsonResponse(
    {
      data: {
        ...inserted,
        amount: Number(inserted.amount),
        categoryIds: categoryIdsForSpent,
        spent,
      },
    },
    201
  );
}
