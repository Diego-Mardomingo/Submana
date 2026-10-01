import { NextRequest } from "next/server";
import { getAuthedClient, jsonError, jsonResponse, jsonServerError, unauthorized } from "@/lib/apiHelpers";
import { getDescendantIds } from "@/lib/categoryTree";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const { data: cat } = await supabase.from("categories").select("user_id, exclude_from_metrics").eq("id", id).single();
  if (!cat) return jsonError("not_found", 404);
  if (cat.user_id !== null) return jsonError("can_only_archive_system");
  if (cat.exclude_from_metrics) return jsonError("cannot_archive_exclude_metrics");

  const body = await request.json().catch(() => ({}));
  const ids = [id];
  if (body.archive_children !== false) {
    const { data: system } = await supabase.from("categories").select("id, parent_id").is("user_id", null);
    ids.push(...getDescendantIds(system ?? [], id));
  }

  const { error } = await supabase
    .from("user_archived_categories")
    .upsert(ids.map((category_id) => ({ user_id: user.id, category_id })), { onConflict: "user_id,category_id" });
  if (error) return jsonServerError("crud/categories/[id]/archive", error);
  return jsonResponse({ data: { success: true } });
}
