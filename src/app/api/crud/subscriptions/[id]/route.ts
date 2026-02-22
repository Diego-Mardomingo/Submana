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

  const contentType = request.headers.get("content-type") || "";
  let body: Record<string, unknown>;
  if (contentType.includes("application/json")) {
    body = (await request.json()) as Record<string, unknown>;
  } else {
    const formData = await request.formData();
    body = {
      service_name: formData.get("name")?.toString(),
      icon: formData.get("icon")?.toString(),
      cost: formData.get("cost")?.toString(),
      start_date: formData.get("startDate")?.toString(),
      end_date: formData.get("endDate")?.toString(),
      frequency: formData.get("frequency")?.toString(),
      frequency_value: formData.get("frequency_value")?.toString(),
      account_id: formData.get("account_id")?.toString(),
    };
  }

  const updates: Record<string, unknown> = {};
  
  if (body.service_name !== undefined) {
    updates.service_name = body.service_name;
  }
  if (body.name !== undefined) {
    updates.service_name = body.name;
  }
  if (body.icon !== undefined) {
    updates.icon = body.icon;
  }
  if (body.cost !== undefined) {
    updates.cost = typeof body.cost === "number" ? body.cost : parseFloat(body.cost as string);
  }
  if (body.start_date !== undefined) {
    updates.start_date = body.start_date;
  }
  if (body.startDate !== undefined) {
    updates.start_date = body.startDate;
  }
  if (body.end_date !== undefined) {
    updates.end_date = body.end_date;
  }
  if (body.endDate !== undefined) {
    updates.end_date = body.endDate;
  }
  if (body.frequency !== undefined) {
    updates.frequency = body.frequency;
  }
  if (body.frequency_value !== undefined) {
    updates.frequency_value = typeof body.frequency_value === "number" 
      ? body.frequency_value 
      : parseInt(body.frequency_value as string, 10);
  }
  if (body.account_id !== undefined) {
    updates.account_id = body.account_id || null;
  }

  if (!id) {
    return jsonError("missing_id");
  }

  if (Object.keys(updates).length === 0) {
    return jsonError("No fields to update", 400);
  }

  const { data: updatedData, error } = await supabase
    .from("subscriptions")
    .update(updates)
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

  const { error } = await supabase
    .from("subscriptions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonResponse({ data: { success: true } });
}
