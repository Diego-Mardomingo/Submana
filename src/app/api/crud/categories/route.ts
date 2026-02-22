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

  const [userCategoriesResult, defaultCategoriesResult] = await Promise.all([
    supabase
      .from("categories")
      .select("*")
      .eq("user_id", user.id)
      .order("name", { ascending: true }),
    supabase
      .from("default_categories")
      .select("*")
      .order("name", { ascending: true }),
  ]);

  if (userCategoriesResult.error) {
    return jsonError(userCategoriesResult.error.message, 500);
  }

  const userCategories = userCategoriesResult.data ?? [];
  const defaultCategories = defaultCategoriesResult.data ?? [];

  const defaultCategoryIds = new Set(defaultCategories.map((c) => c.id));

  const userParents = userCategories.filter(
    (c) => !c.parent_id || !defaultCategoryIds.has(c.parent_id)
  ).filter((c) => !c.parent_id);
  
  const userChildrenUnderUserParents = userCategories.filter(
    (c) => c.parent_id && !defaultCategoryIds.has(c.parent_id)
  );
  
  const userChildrenUnderDefaultParents = userCategories.filter(
    (c) => c.parent_id && defaultCategoryIds.has(c.parent_id)
  );

  const structuredUserCategories = userParents.map((parent) => ({
    ...parent,
    isDefault: false,
    subcategories: userChildrenUnderUserParents
      .filter((child) => child.parent_id === parent.id)
      .map((child) => ({ ...child, isDefault: false })),
  }));

  const defaultParents = defaultCategories.filter((c) => !c.parent_id);
  const defaultChildren = defaultCategories.filter((c) => c.parent_id);
  
  const structuredDefaultCategories = defaultParents.map((parent) => {
    const defaultSubs = defaultChildren
      .filter((child) => child.parent_id === parent.id)
      .map((child) => ({ ...child, isDefault: true }));
    
    const userSubs = userChildrenUnderDefaultParents
      .filter((child) => child.parent_id === parent.id)
      .map((child) => ({ ...child, isDefault: false }));
    
    return {
      ...parent,
      isDefault: true,
      subcategories: [...defaultSubs, ...userSubs],
    };
  });

  return jsonResponse({
    data: {
      defaultCategories: structuredDefaultCategories,
      userCategories: structuredUserCategories,
    },
  });
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
  const icon = body.icon || null;
  const parent_id =
    body.parent_id === "null" || body.parent_id === "" ? null : body.parent_id;

  if (!name) {
    return jsonError("missing_fields");
  }

  const { data: insertedData, error } = await supabase
    .from("categories")
    .insert({ user_id: user.id, name, parent_id, icon })
    .select()
    .single();

  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonResponse({ data: insertedData }, 201);
}
