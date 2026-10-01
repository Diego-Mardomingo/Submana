import { getAuthedClient, jsonError, jsonResponse, unauthorized } from "@/lib/apiHelpers";

export async function POST(request: Request) {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const { table, items } = (await request.json()) as { table: string; items: { id: string; display_order: number }[] };
  if (table !== "accounts" && table !== "budgets") return jsonError("Invalid table. Must be 'accounts' or 'budgets'");
  if (!Array.isArray(items) || items.length === 0) return jsonError("Items array is required and must not be empty");

  const results = await Promise.all(
    items.map((item) =>
      supabase.from(table).update({ display_order: item.display_order }).eq("id", item.id).eq("user_id", user.id)
    )
  );
  if (results.some((r) => r.error)) return jsonError("Error updating order for some items", 500);
  return jsonResponse({ success: true });
}
