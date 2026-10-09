import { NextRequest } from "next/server";
import { getAccountAccess, getAuthedClient, jsonCachedResponse, jsonError, jsonResponse, jsonServerError, parseRequestBody, unauthorized } from "@/lib/apiHelpers";
import { initialsAvatarDataUri } from "@/lib/initialsAvatar";
import { normalizeReminderOffsets, parseReminderOffsetsInput, validateSubscriptionFields } from "@/lib/subscriptionValidation";

export async function GET() {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const { data, error } = await supabase.from("subscriptions").select("*").eq("user_id", user.id).order("id", { ascending: true });
  if (error) return jsonServerError("crud/subscriptions", error);
  return jsonCachedResponse({ data });
}

export async function POST(request: NextRequest) {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const body = await parseRequestBody(request);
  const name = body.service_name;
  if (!name || !body.start_date) return jsonError("missing_fields");
  const fields = {
    cost: body.cost ? parseFloat(body.cost) : 0,
    start_date: body.start_date,
    end_date: body.end_date || null,
    frequency: body.frequency || "monthly",
    frequency_value: body.frequency_value ? Number(body.frequency_value) : 1,
    account_id: body.account_id || null,
    // Left out when absent: the column default applies.
    ...(body.reminder_offsets !== undefined && { reminder_offsets: parseReminderOffsetsInput(body.reminder_offsets) }),
  };
  const invalid = validateSubscriptionFields(fields);
  if (invalid) return jsonError(invalid);
  if (Array.isArray(fields.reminder_offsets)) fields.reminder_offsets = normalizeReminderOffsets(fields.reminder_offsets);
  if (fields.account_id && (await getAccountAccess(supabase, user.id, fields.account_id))?.role !== "owner") return jsonError("Account not found", 404);

  const { data, error } = await supabase
    .from("subscriptions")
    .insert({ user_id: user.id, service_name: name, icon: body.icon || initialsAvatarDataUri(name), ...fields })
    .select()
    .single();
  if (error) return jsonServerError("crud/subscriptions", error);
  return jsonResponse({ data }, 201);
}
