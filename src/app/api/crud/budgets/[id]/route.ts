import { createClient } from "@/lib/supabase/server";
import { jsonError, jsonResponse } from "@/lib/apiHelpers";
import { NextRequest } from "next/server";
import { computeBudgetSpent, type CategoryRow } from "@/lib/budgetHelpers";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return jsonError("Unauthorized", 401);
  }

  if (!id) {
    return jsonError("missing_id");
  }

  const { data: budget, error } = await supabase
    .from("budgets")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !budget) {
    return jsonError("Budget not found", 404);
  }

  const { data: budgetCats } = await supabase
    .from("budget_categories")
    .select("category_id")
    .eq("budget_id", id);
  const categoryIds = (budgetCats ?? []).map((r) => r.category_id);

  const now = new Date();
  const { data: categoriesRows } = await supabase
    .from("categories")
    .select("id, parent_id")
    .or("user_id.eq." + user.id + ",user_id.is.null");
  const allCategories: CategoryRow[] = categoriesRows ?? [];
  const spent = await computeBudgetSpent(
    supabase,
    user.id,
    categoryIds,
    allCategories,
    now.getFullYear(),
    now.getMonth() + 1
  );

  return jsonResponse({
    data: {
      ...budget,
      amount: Number(budget.amount),
      categoryIds,
      spent,
    },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return jsonError("Unauthorized", 401);
  }

  if (!id) {
    return jsonError("missing_id");
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonError("Invalid JSON body");
  }

  const { data: existing } = await supabase
    .from("budgets")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!existing) {
    return jsonError("Budget not found", 404);
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name !== undefined && typeof body.name === "string") {
    updates.name = body.name.trim();
  }
  if (body.amount !== undefined) {
    const num = typeof body.amount === "number" ? body.amount : parseFloat(String(body.amount));
    if (!isNaN(num) && num >= 0) updates.amount = num;
  }
  if (body.color !== undefined) {
    updates.color = typeof body.color === "string" && body.color ? body.color : null;
  }

  const { error: updateError } = await supabase
    .from("budgets")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id);

  if (updateError) {
    return jsonError(updateError.message, 500);
  }

  if (Array.isArray(body.category_ids)) {
    const newCategoryIds = body.category_ids.filter((c): c is string => typeof c === "string");
    await supabase.from("budget_categories").delete().eq("budget_id", id);
    if (newCategoryIds.length > 0) {
      await supabase.from("budget_categories").insert(
        newCategoryIds.map((category_id) => ({ budget_id: id, category_id }))
      );
    }
  }

  const { data: budget } = await supabase
    .from("budgets")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  const { data: budgetCats } = await supabase
    .from("budget_categories")
    .select("category_id")
    .eq("budget_id", id);
  const categoryIds = (budgetCats ?? []).map((r) => r.category_id);

  const now = new Date();
  const { data: categoriesRows } = await supabase
    .from("categories")
    .select("id, parent_id")
    .or("user_id.eq." + user.id + ",user_id.is.null");
  const allCategories: CategoryRow[] = categoriesRows ?? [];
  const spent = await computeBudgetSpent(
    supabase,
    user.id,
    categoryIds,
    allCategories,
    now.getFullYear(),
    now.getMonth() + 1
  );

  return jsonResponse({
    data: {
      ...budget,
      amount: Number(budget?.amount ?? 0),
      categoryIds,
      spent,
    },
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return jsonError("Unauthorized", 401);
  }

  if (!id) {
    return jsonError("missing_id");
  }

  const { error } = await supabase
    .from("budgets")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonResponse({ data: { success: true } });
}
