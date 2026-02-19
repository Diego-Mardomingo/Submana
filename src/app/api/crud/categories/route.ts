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

  const { data: categories, error } = await supabase
    .from("categories")
    .select("*")
    .eq("user_id", user.id)
    .order("name", { ascending: true });

  if (error) {
    return jsonError(error.message, 500);
  }

  const parents = categories?.filter((c) => !c.parent_id) ?? [];
  const children = categories?.filter((c) => c.parent_id) ?? [];
  const structuredCategories = parents.map((parent) => ({
    ...parent,
    subcategories: children.filter(
      (child) => child.parent_id === parent.id
    ),
  }));

  return jsonResponse({ data: structuredCategories });
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
  const parent_id =
    body.parent_id === "null" || body.parent_id === "" ? null : body.parent_id;

  if (!name) {
    return jsonError("missing_fields");
  }

  const { data: insertedData, error } = await supabase
    .from("categories")
    .insert({ user_id: user.id, name, parent_id })
    .select()
    .single();

  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonResponse({ data: insertedData }, 201);
}
