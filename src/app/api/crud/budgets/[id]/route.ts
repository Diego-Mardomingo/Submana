import { NextRequest } from "next/server";
import { areAccessibleCategories, getAuthedClient, jsonError, jsonResponse, jsonServerError, unauthorized } from "@/lib/apiHelpers";
import { loadBudgetSpentCalculator, readBudgetInput } from "@/lib/budgetHelpers";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const body = await request.json().catch(() => null);
  if (!body) return jsonError("Invalid JSON body");
  const { amount, color, categoryIds } = readBudgetInput(body);
  if (categoryIds && !(await areAccessibleCategories(supabase, user.id, categoryIds))) return jsonError("invalid_category");

  const { data: budget, error } = await supabase
    .from("budgets")
    .update({
      updated_at: new Date().toISOString(),
      ...(amount !== undefined && { amount }),
      ...(color !== undefined && { color }),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .maybeSingle();
  if (error) return jsonServerError("crud/budgets/[id]", error);
  if (!budget) return jsonError("Budget not found", 404);

  if (categoryIds) {
    const { error: deleteError } = await supabase.from("budget_categories").delete().eq("budget_id", id);
    if (deleteError) return jsonServerError("crud/budgets/[id]", deleteError);
    if (categoryIds.length > 0) {
      const { error: insertError } = await supabase
        .from("budget_categories")
        .insert(categoryIds.map((category_id) => ({ budget_id: id, category_id })));
      if (insertError) return jsonServerError("crud/budgets/[id]", insertError);
    }
  }

  const { data: links } = await supabase.from("budget_categories").select("category_id").eq("budget_id", id);
  const linkedIds = (links ?? []).map((r) => r.category_id as string);
  const now = new Date();
  const spentFor = await loadBudgetSpentCalculator(supabase, user.id, now.getFullYear(), now.getMonth() + 1);
  return jsonResponse({ data: { ...budget, amount: Number(budget.amount), categoryIds: linkedIds, spent: spentFor(linkedIds) } });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const { error } = await supabase.from("budgets").delete().eq("id", id).eq("user_id", user.id);
  if (error) return jsonServerError("crud/budgets/[id]", error);
  return jsonResponse({ data: { success: true } });
}
