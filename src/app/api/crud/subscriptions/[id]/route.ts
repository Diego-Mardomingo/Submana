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
  let body: Record<string, string>;
  if (contentType.includes("application/json")) {
    body = (await request.json()) as Record<string, string>;
  } else {
    const formData = await request.formData();
    body = {
      service_name: formData.get("name")?.toString() ?? "",
      icon: formData.get("icon")?.toString() ?? "",
      cost: formData.get("cost")?.toString() ?? "0",
      start_date: formData.get("startDate")?.toString() ?? "",
      end_date: formData.get("endDate")?.toString() ?? "",
      frequency: formData.get("frequency")?.toString() ?? "monthly",
      frequency_value: formData.get("frequency_value")?.toString() ?? "1",
    };
  }

  const updates = {
    service_name: body.service_name || body.name,
    icon: body.icon,
    cost: body.cost ? parseFloat(body.cost) : 0,
    start_date: body.start_date || body.startDate,
    end_date: body.end_date || body.endDate || null,
    frequency: body.frequency || "monthly",
    frequency_value: body.frequency_value
      ? parseInt(body.frequency_value, 10)
      : 1,
  };

  if (!id) {
    return jsonError("missing_id");
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
