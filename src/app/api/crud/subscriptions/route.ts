import { createClient } from "@/lib/supabase/server";
import { jsonError, jsonResponse, parseRequestBody } from "@/lib/apiHelpers";
import { NextRequest } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return jsonError("Unauthorized", 401);
  }

  const { data: subscriptions, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .order("id", { ascending: true });

  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonResponse({ data: subscriptions });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return jsonError("Unauthorized", 401);
  }

  const { body } = await parseRequestBody(request);
  const service_name = (body.service_name || body.name) as string;
  const icon = body.icon;
  const cost = body.cost ? parseFloat(body.cost) : 0;
  const startDate = (body.startDate || body.start_date) as string;
  const endDate = (body.endDate || body.end_date) as string;
  const frequency = body.frequency || "monthly";
  const frequencyValue = body.frequency_value
    ? parseInt(body.frequency_value, 10)
    : 1;

  const defaultIcon = `https://ui-avatars.com/api/?name=${encodeURIComponent(service_name || "Sub")}&length=2&background=random&color=fff&size=256`;

  const { data: insertedData, error } = await supabase
    .from("subscriptions")
    .insert({
      user_id: user.id,
      service_name,
      icon: icon || defaultIcon,
      cost,
      start_date: startDate,
      end_date: endDate || null,
      frequency,
      frequency_value: frequencyValue,
    })
    .select()
    .single();

  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonResponse({ data: insertedData }, 201);
}
