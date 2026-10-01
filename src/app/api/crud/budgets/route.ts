import { NextRequest } from "next/server";
import { areAccessibleCategories, getAuthedClient, jsonCachedResponse, jsonError, jsonResponse, jsonServerError, unauthorized } from "@/lib/apiHelpers";
import { loadBudgetSpentCalculator, readBudgetInput } from "@/lib/budgetHelpers";

export async function GET(request: NextRequest) {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const monthParam = request.nextUrl.searchParams.get("month"); // YYYY-MM
  if (monthParam && !/^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam)) return jsonError("invalid_month");
  const now = new Date();
  const year = monthParam ? parseInt(monthParam.slice(0, 4), 10) : now.getFullYear();
  const month = monthParam ? parseInt(monthParam.slice(5, 7), 10) : now.getMonth() + 1;

  const { data: budgets, error } = await supabase
    .from("budgets")
    .select("id, user_id, amount, color, created_at, updated_at")
    .eq("user_id", user.id)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) return jsonServerError("crud/budgets", error);
  if (!budgets.length) return jsonResponse({ data: [] });

  const [{ data: links }, spentFor] = await Promise.all([
    supabase.from("budget_categories").select("budget_id, category_id").in("budget_id", budgets.map((b) => b.id)),
    loadBudgetSpentCalculator(supabase, user.id, year, month),
  ]);
  const data = budgets.map((budget) => {
    const categoryIds = (links ?? []).filter((l) => l.budget_id === budget.id).map((l) => l.category_id as string);
    return { ...budget, amount: Number(budget.amount), categoryIds, spent: spentFor(categoryIds) };
  });
  return jsonCachedResponse({ data });
}

export async function POST(request: NextRequest) {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const body = await request.json().catch(() => null);
  if (!body) return jsonError("Invalid JSON body");
  const { amount, color, categoryIds = [] } = readBudgetInput(body);
  if (amount === undefined) return jsonError("missing_fields");
  if (!(await areAccessibleCategories(supabase, user.id, categoryIds))) return jsonError("invalid_category");

  const { count } = await supabase.from("budgets").select("*", { count: "exact", head: true }).eq("user_id", user.id);
  const { data: inserted, error } = await supabase
    .from("budgets")
    .insert({
      user_id: user.id,
      name: categoryIds.length > 0 ? `Budget (${categoryIds.length} categories)` : "General Budget",
      amount,
      color: color ?? null,
      display_order: count ?? 0,
    })
    .select()
    .single();
  if (error) return jsonServerError("crud/budgets", error);

  if (categoryIds.length > 0) {
    const { error: relError } = await supabase
      .from("budget_categories")
      .insert(categoryIds.map((category_id) => ({ budget_id: inserted.id, category_id })));
    if (relError) {
      await supabase.from("budgets").delete().eq("id", inserted.id);
      return jsonServerError("crud/budgets", relError);
    }
  }

  const now = new Date();
  const spentFor = await loadBudgetSpentCalculator(supabase, user.id, now.getFullYear(), now.getMonth() + 1);
  return jsonResponse({ data: { ...inserted, amount: Number(inserted.amount), categoryIds, spent: spentFor(categoryIds) } }, 201);
}
