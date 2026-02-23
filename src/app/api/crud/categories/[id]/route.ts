import { createClient } from "@/lib/supabase/server";
import { jsonError, jsonResponse, parseRequestBody } from "@/lib/apiHelpers";
import { NextRequest } from "next/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return jsonError("Unauthorized", 401);
  }

  const { body } = await parseRequestBody(request);
  const name = body.name;
  const emoji = body.emoji;

  if (!id || !name) {
    return jsonError("missing_fields");
  }

  const { data: existing } = await supabase
    .from("categories")
    .select("user_id")
    .eq("id", id)
    .single();

  if (!existing) return jsonError("not_found", 404);
  if (existing.user_id === null) return jsonError("cannot_edit_system", 403);
  if (existing.user_id !== user.id) return jsonError("forbidden", 403);

  const updateData: { name: string; emoji?: string | null } = { name };
  if (emoji !== undefined) {
    updateData.emoji = emoji || null;
  }

  const { data: updatedData, error } = await supabase
    .from("categories")
    .update(updateData)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonResponse({ data: updatedData });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return jsonError("Unauthorized", 401);
  }

  if (!id) {
    return jsonError("missing_id");
  }

  const { data: existing } = await supabase
    .from("categories")
    .select("user_id")
    .eq("id", id)
    .single();

  if (!existing) return jsonError("not_found", 404);
  if (existing.user_id === null) return jsonError("cannot_delete_system", 403);
  if (existing.user_id !== user.id) return jsonError("forbidden", 403);

  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonResponse({ data: { success: true } });
}
