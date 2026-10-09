import { NextRequest } from "next/server";
import { getAccountAccess, getAuthedClient, jsonError, jsonResponse, jsonServerError, unauthorized } from "@/lib/apiHelpers";
import { normalizeReminderOffsets, validateSubscriptionFields } from "@/lib/subscriptionValidation";

type Params = { params: Promise<{ id: string }> };

const EDITABLE = ["service_name", "icon", "cost", "start_date", "end_date", "frequency", "frequency_value", "account_id", "reminder_offsets"];

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const body = (await request.json()) as Record<string, unknown>;
  const updates = Object.fromEntries(EDITABLE.filter((key) => body[key] !== undefined).map((key) => [key, body[key]]));
  if ("account_id" in updates) updates.account_id ||= null;
  if (Object.keys(updates).length === 0) return jsonError("No fields to update");
  const invalid = validateSubscriptionFields(updates);
  if (invalid) return jsonError(invalid);
  if (Array.isArray(updates.reminder_offsets)) updates.reminder_offsets = normalizeReminderOffsets(updates.reminder_offsets);
  if (typeof updates.account_id === "string" && (await getAccountAccess(supabase, user.id, updates.account_id))?.role !== "owner") {
    return jsonError("Account not found", 404);
  }

  const { data, error } = await supabase
    .from("subscriptions")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .maybeSingle();
  if (error) return jsonServerError("crud/subscriptions/[id]", error);
  if (!data) return jsonError("Subscription not found", 404);
  return jsonResponse({ data });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const { error } = await supabase.from("subscriptions").delete().eq("id", id).eq("user_id", user.id);
  if (error) return jsonServerError("crud/subscriptions/[id]", error);
  return jsonResponse({ data: { success: true } });
}
