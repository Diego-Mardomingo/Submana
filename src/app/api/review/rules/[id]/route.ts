import { NextRequest } from "next/server";
import { getAuthedClient, jsonError, jsonResponse, jsonServerError, unauthorized } from "@/lib/apiHelpers";

type Params = { params: Promise<{ id: string }> };

/** Forget a learnt rule: the next movements of that merchant go back to being guessed. */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();
  const { data, error } = await supabase.from("category_rules").delete().eq("id", id).eq("user_id", user.id).select("id").maybeSingle();
  if (error) return jsonServerError("review/rules/[id]", error);
  if (!data) return jsonError("rule_not_found", 404);
  return jsonResponse({ data: { success: true } });
}
