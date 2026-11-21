import { getAuthedClient, jsonResponse, jsonServerError, unauthorized } from "@/lib/apiHelpers";

/** The rules the deck learnt ("AMAZON MKTPLACE" → Technology), newest first. */
export async function GET() {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();
  const { data, error } = await supabase
    .from("category_rules")
    .select("id, pattern, category_id, subcategory_id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) return jsonServerError("review/rules", error);
  return jsonResponse({ data: data ?? [] });
}
