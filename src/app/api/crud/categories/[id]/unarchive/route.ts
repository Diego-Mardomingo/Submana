import { createClient } from "@/lib/supabase/server";
import { jsonError, jsonServerError, jsonResponse } from "@/lib/apiHelpers";
import { NextRequest } from "next/server";
import { getSystemDescendantIds, getAncestorIds } from "@/lib/categoryTree";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return jsonError("Unauthorized", 401);
  if (!id) return jsonError("missing_id");

  const { data: cat } = await supabase
    .from("categories")
    .select("id, user_id, parent_id")
    .eq("id", id)
    .single();

  if (!cat) return jsonError("not_found", 404);
  if (cat.user_id !== null) return jsonError("can_only_unarchive_system", 400);

  const { data: allSystem } = await supabase
    .from("categories")
    .select("id, parent_id, user_id")
    .is("user_id", null);

  const categories = allSystem ?? [];

  // 1. Unarchive this category
  const idsToUnarchive: string[] = [id];

  // 2. If it's a parent, also unarchive all system descendants (children, grandchildren)
  const descendantIds = getSystemDescendantIds(categories, id);
  idsToUnarchive.push(...descendantIds);

  // 3. If it's a subcategory, also unarchive ancestors (parent, grandparent) so the tree shows correctly
  const ancestorIds = getAncestorIds(categories, id);
  idsToUnarchive.push(...ancestorIds);

  const uniqueIds = [...new Set(idsToUnarchive)];

  const { error } = await supabase
    .from("user_archived_categories")
    .delete()
    .eq("user_id", user.id)
    .in("category_id", uniqueIds);

  if (error) return jsonServerError("/api/crud/categories/[id]/unarchive", error);
  return jsonResponse({ data: { success: true } });
}
