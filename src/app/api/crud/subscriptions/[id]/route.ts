import { NextRequest } from "next/server";
import { getAuthedClient, isOwnedAccount, jsonError, jsonResponse, jsonServerError, unauthorized } from "@/lib/apiHelpers";
import { validateSubscriptionFields } from "@/lib/subscriptionValidation";

type Params = { params: Promise<{ id: string }> };

const EDITABLE = ["service_name", "icon", "cost", "start_date", "end_date", "frequency", "frequency_value", "account_id"];

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
  if (typeof updates.account_id === "string" && !(await isOwnedAccount(supabase, user.id, updates.account_id))) {
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
