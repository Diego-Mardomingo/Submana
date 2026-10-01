import { NextRequest } from "next/server";
import { getAuthedClient, jsonCachedResponse, jsonError, jsonResponse, parseRequestBody, unauthorized } from "@/lib/apiHelpers";

export async function GET() {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const { data, error } = await supabase.from("subscriptions").select("*").eq("user_id", user.id).order("id", { ascending: true });
  if (error) return jsonError(error.message, 500);
  return jsonCachedResponse({ data }, 120, 600);
}

export async function POST(request: NextRequest) {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const body = await parseRequestBody(request);
  const name = body.service_name;
  const { data, error } = await supabase
    .from("subscriptions")
    .insert({
      user_id: user.id,
      service_name: name,
      icon:
        body.icon ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "Sub")}&length=2&background=random&color=fff&size=256`,
      cost: body.cost ? parseFloat(body.cost) : 0,
      start_date: body.start_date,
      end_date: body.end_date || null,
      frequency: body.frequency || "monthly",
      frequency_value: body.frequency_value ? parseInt(body.frequency_value, 10) : 1,
      account_id: body.account_id || null,
    })
    .select()
    .single();
  if (error) return jsonError(error.message, 500);
  return jsonResponse({ data }, 201);
}
