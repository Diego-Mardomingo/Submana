import { createClient } from "@/lib/supabase/server";
import { jsonError, jsonResponse, jsonCachedResponse, parseRequestBody } from "@/lib/apiHelpers";
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

  const { data: accounts, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonCachedResponse({ data: accounts }, 200, 120, 600);
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
  const name = body.name;
  const balance = body.balance ? parseFloat(body.balance) : 0;
  const icon = body.icon;
  const color = body.color;
  const bank_provider = body.bank_provider || null;

  if (!name || isNaN(balance)) {
    return jsonError("missing_fields");
  }

  const { data: insertedData, error } = await supabase
    .from("accounts")
    .insert({ user_id: user.id, name, balance, icon, color, bank_provider })
    .select()
    .single();

  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonResponse({ data: insertedData }, 201);
}
