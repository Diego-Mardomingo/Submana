import { NextRequest } from "next/server";
import { getAuthedClient, jsonCachedResponse, jsonError, jsonResponse, jsonServerError, parseRequestBody, unauthorized } from "@/lib/apiHelpers";

export async function GET() {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("user_id", user.id)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) return jsonServerError("crud/accounts", error);
  return jsonCachedResponse({ data });
}

export async function POST(request: NextRequest) {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const { name, icon, color, ...body } = await parseRequestBody(request);
  const balance = body.balance ? parseFloat(body.balance) : 0;
  if (!name || isNaN(balance)) return jsonError("missing_fields");

  const { count } = await supabase.from("accounts").select("*", { count: "exact", head: true }).eq("user_id", user.id);
  const { data, error } = await supabase
    .from("accounts")
    .insert({ user_id: user.id, name, balance, icon, color, bank_provider: body.bank_provider || null, display_order: count ?? 0 })
    .select()
    .single();
  if (error) return jsonServerError("crud/accounts", error);
  return jsonResponse({ data }, 201);
}
