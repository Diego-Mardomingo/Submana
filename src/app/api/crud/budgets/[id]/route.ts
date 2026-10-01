import { NextRequest } from "next/server";
import { getAuthedClient, jsonError, jsonResponse, unauthorized } from "@/lib/apiHelpers";
import { loadBudgetSpentCalculator, readBudgetInput } from "@/lib/budgetHelpers";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const body = await request.json().catch(() => null);
  if (!body) return jsonError("Invalid JSON body");
  const { amount, color, categoryIds } = readBudgetInput(body);

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
  if (error) return jsonError(error.message, 500);
  if (!budget) return jsonError("Budget not found", 404);

  if (categoryIds) {
    await supabase.from("budget_categories").delete().eq("budget_id", id);
    if (categoryIds.length > 0) {
      await supabase.from("budget_categories").insert(categoryIds.map((category_id) => ({ budget_id: id, category_id })));
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
  if (error) return jsonError(error.message, 500);
  return jsonResponse({ data: { success: true } });
}
