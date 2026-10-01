import { NextRequest } from "next/server";
import { getAuthedClient, jsonError, jsonResponse, unauthorized } from "@/lib/apiHelpers";
import { getAncestorIds, getDescendantIds } from "@/lib/categoryTree";

/** Unarchives a system category, its descendants and its ancestors (so the tree renders correctly). */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const { data: cat } = await supabase.from("categories").select("user_id").eq("id", id).single();
  if (!cat) return jsonError("not_found", 404);
  if (cat.user_id !== null) return jsonError("can_only_unarchive_system");

  const { data } = await supabase.from("categories").select("id, parent_id").is("user_id", null);
  const system = data ?? [];
  const ids = [...new Set([id, ...getDescendantIds(system, id), ...getAncestorIds(system, id)])];

  const { error } = await supabase.from("user_archived_categories").delete().eq("user_id", user.id).in("category_id", ids);
  if (error) return jsonError(error.message, 500);
  return jsonResponse({ data: { success: true } });
}
