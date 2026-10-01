import { createClient } from "@/lib/supabase/server";
import { areAccessibleCategories, jsonError, jsonServerError, jsonResponse, jsonCachedResponse } from "@/lib/apiHelpers";
import { NextRequest } from "next/server";
import { computeBudgetSpent, computeBudgetsSpent, type CategoryRow } from "@/lib/budgetHelpers";

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
  if (monthParam && !/^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam)) {
    return jsonError("invalid_month");
  }
  const year = monthParam ? parseInt(monthParam.slice(0, 4), 10) : now.getFullYear();
  const month = monthParam ? parseInt(monthParam.slice(5, 7), 10) : now.getMonth() + 1;

  const { data: budgets, error: budgetsError } = await supabase
    .from("budgets")
    .select("id, user_id, amount, color, created_at, updated_at")
    .eq("user_id", user.id)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (budgetsError) {
    return jsonServerError("/api/crud/budgets", budgetsError);
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
    .select("id, parent_id, exclude_from_metrics")
    .or("user_id.eq." + user.id + ",user_id.is.null");
  const allCategories: CategoryRow[] = categoriesRows ?? [];

  const spentByBudget = await computeBudgetsSpent(
    supabase,
    user.id,
    list.map((budget) => ({ id: budget.id, categoryIds: categoriesByBudget.get(budget.id) ?? [] })),
    allCategories,
    year,
    month
  );
  const result = list.map((budget) => ({
    ...budget,
    amount: Number(budget.amount),
    categoryIds: categoriesByBudget.get(budget.id) ?? [],
    spent: spentByBudget.get(budget.id) ?? 0,
  }));

  return jsonCachedResponse({ data: result });
}

export async function POST(request: NextRequest) {
  try {
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

    if (!Number.isFinite(amount) || amount < 0) {
      return jsonError("missing_fields");
    }

    if (!(await areAccessibleCategories(supabase, user.id, categoryIds))) {
      return jsonError("invalid_category");
    }

    const now = new Date().toISOString();
    const name = categoryIds.length > 0 ? `Budget (${categoryIds.length} categories)` : "General Budget";
    
    const { count } = await supabase
      .from("budgets")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);
    
    const display_order = (count ?? 0);

    const { data: inserted, error: insertError } = await supabase
      .from("budgets")
      .insert({
        user_id: user.id,
        name,
        amount,
        color,
        display_order,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[POST /api/crud/budgets] Insert error:", insertError);
      return jsonServerError("/api/crud/budgets", insertError);
    }

    if (categoryIds.length > 0) {
      const rows = categoryIds.map((category_id) => ({
        budget_id: inserted.id,
        category_id,
      }));
      const { error: relError } = await supabase.from("budget_categories").insert(rows);
      if (relError) {
        console.error("[POST /api/crud/budgets] Category relation error:", relError);
        await supabase.from("budgets").delete().eq("id", inserted.id);
        return jsonServerError("/api/crud/budgets", relError);
      }
    }

    const categoryIdsForSpent = categoryIds;
    const spentDate = new Date();
    const { data: categoriesRows } = await supabase
      .from("categories")
      .select("id, parent_id, exclude_from_metrics")
      .or("user_id.eq." + user.id + ",user_id.is.null");
    const allCategories: CategoryRow[] = categoriesRows ?? [];
    const spent = await computeBudgetSpent(
      supabase,
      user.id,
      categoryIdsForSpent,
      allCategories,
      spentDate.getFullYear(),
      spentDate.getMonth() + 1
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
  } catch (error) {
    console.error("[POST /api/crud/budgets] Unexpected error:", error);
    return jsonServerError("/api/crud/budgets", error);
  }
}
