import { fetchAllPages, getAuthedClient, jsonCachedResponse, jsonServerError, unauthorized } from "@/lib/apiHelpers";

const DAYS = 90;

/**
 * How many of my transactions of the last 90 days use each category and subcategory, per type.
 * The transaction form lists the categories I use most first.
 */
export async function GET() {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const since = new Date(Date.now() - DAYS * 86_400_000).toISOString().slice(0, 10);
  try {
    const rows = await fetchAllPages<{ type: string; category_id: string | null; subcategory_id: string | null }>((from, to) =>
      supabase
        .from("transactions")
        .select("type, category_id, subcategory_id")
        .eq("user_id", user.id)
        .gte("date", since)
        .order("id", { ascending: true })
        .range(from, to)
    );
    const usage: Record<"income" | "expense", Record<string, number>> = { income: {}, expense: {} };
    for (const row of rows) {
      const counts = row.type === "income" ? usage.income : usage.expense;
      for (const id of [row.category_id, row.subcategory_id]) if (id) counts[id] = (counts[id] ?? 0) + 1;
    }
    return jsonCachedResponse({ data: usage });
  } catch (error) {
    return jsonServerError("crud/transactions/category-usage", error);
  }
}
