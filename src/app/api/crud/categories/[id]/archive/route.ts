import { createClient } from "@/lib/supabase/server";
import { jsonError, jsonServerError, jsonResponse } from "@/lib/apiHelpers";
import { NextRequest } from "next/server";
import { getSystemDescendantIds } from "@/lib/categoryTree";

export async function POST(
  request: NextRequest,
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
    .select("id, user_id, parent_id, exclude_from_metrics")
    .eq("id", id)
    .single();

  if (!cat) return jsonError("not_found", 404);
  if (cat.user_id !== null) return jsonError("can_only_archive_system", 400);
  if (cat.exclude_from_metrics === true) return jsonError("cannot_archive_exclude_metrics", 400);

  const body = await request.json().catch(() => ({}));
  const archiveChildren = body.archive_children !== false;

  const idsToArchive: string[] = [id];
  if (archiveChildren) {
    const { data: allSystem } = await supabase
      .from("categories")
      .select("id, parent_id, user_id")
      .is("user_id", null);
    const desc = getSystemDescendantIds(allSystem ?? [], id);
    idsToArchive.push(...desc);
  }

  const rows = idsToArchive.map((category_id) => ({ user_id: user.id, category_id }));
  const { error } = await supabase
    .from("user_archived_categories")
    .upsert(rows, { onConflict: "user_id,category_id" });

  if (error) return jsonServerError("/api/crud/categories/[id]/archive", error);
  return jsonResponse({ data: { success: true } });
}
