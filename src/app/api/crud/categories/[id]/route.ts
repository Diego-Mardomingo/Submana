import type { SupabaseClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { getAuthedClient, jsonError, jsonResponse, jsonServerError, parseRequestBody, unauthorized } from "@/lib/apiHelpers";

type Params = { params: Promise<{ id: string }> };

/** Only the owner can modify a user category; system categories (user_id null) are read-only. */
async function ownershipError(supabase: SupabaseClient, id: string, userId: string, action: string) {
  const { data } = await supabase.from("categories").select("user_id").eq("id", id).single();
  if (!data) return jsonError("not_found", 404);
  if (data.user_id === null) return jsonError(`cannot_${action}_system`, 403);
  if (data.user_id !== userId) return jsonError("forbidden", 403);
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const { name, emoji } = await parseRequestBody(request);
  if (!name) return jsonError("missing_fields");
  const denied = await ownershipError(supabase, id, user.id, "edit");
  if (denied) return denied;

  const { data, error } = await supabase
    .from("categories")
    .update({ name, ...(emoji !== undefined && { emoji: emoji || null }) })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .maybeSingle();
  if (error) return jsonServerError("crud/categories/[id]", error);
  if (!data) return jsonError("not_found", 404);
  return jsonResponse({ data });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const denied = await ownershipError(supabase, id, user.id, "delete");
  if (denied) return denied;

  const { error } = await supabase.from("categories").delete().eq("id", id).eq("user_id", user.id);
  if (error) return jsonServerError("crud/categories/[id]", error);
  return jsonResponse({ data: { success: true } });
}
