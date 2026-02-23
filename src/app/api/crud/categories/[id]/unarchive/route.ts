import { createClient } from "@/lib/supabase/server";
import { jsonError, jsonResponse } from "@/lib/apiHelpers";
import { NextRequest } from "next/server";

/** Get all system descendant category IDs (children, grandchildren, ...) */
function getSystemDescendantIds(
  categories: { id: string; parent_id: string | null; user_id: string | null }[],
  parentId: string
): string[] {
  const ids: string[] = [];
  const queue = [parentId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const children = categories.filter((c) => c.parent_id === id && c.user_id === null);
    for (const c of children) {
      ids.push(c.id);
      queue.push(c.id);
    }
  }
  return ids;
}

/** Get ancestor chain (parent, grandparent, ... up to root) for a category */
function getAncestorIds(
  categories: { id: string; parent_id: string | null }[],
  categoryId: string
): string[] {
  const ids: string[] = [];
  let currentId: string | null = categoryId;
  const byId = new Map(categories.map((c) => [c.id, c]));
  while (currentId) {
    const cat = byId.get(currentId);
    if (!cat?.parent_id) break;
    ids.push(cat.parent_id);
    currentId = cat.parent_id;
  }
  return ids;
}

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

  if (error) return jsonError(error.message, 500);
  return jsonResponse({ data: { success: true } });
}
