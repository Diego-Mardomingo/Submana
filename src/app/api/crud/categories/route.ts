import { createClient } from "@/lib/supabase/server";
import { jsonError, jsonResponse, jsonCachedResponse, parseRequestBody } from "@/lib/apiHelpers";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return jsonError("Unauthorized", 401);
  }

  const { searchParams } = new URL(request.url);
  const archived = searchParams.get("archived") === "true";

  if (archived) {
    const { data: archivedRows } = await supabase
      .from("user_archived_categories")
      .select("category_id")
      .eq("user_id", user.id);

    const archivedIds = new Set((archivedRows ?? []).map((r) => r.category_id));

    const { data: archivedCats, error } = await supabase
      .from("categories")
      .select("*")
      .is("user_id", null)
      .in("id", Array.from(archivedIds))
      .order("name", { ascending: true });

    if (error) return jsonError(error.message, 500);

    const archived = archivedCats ?? [];
    const archivedParents = archived.filter((c) => !c.parent_id);
    const archivedChildren = archived.filter((c) => c.parent_id);

    // Orphan subcategories: archived children whose parent is not archived
    const orphanParentIds = [...new Set(archivedChildren.map((c) => c.parent_id!))].filter(
      (pid) => !archivedIds.has(pid)
    );

    let structuralParents: { id: string; name: string; name_en?: string; emoji?: string; parent_id?: string | null }[] = [];
    if (orphanParentIds.length > 0) {
      const { data: parents } = await supabase
        .from("categories")
        .select("id, name, name_en, emoji, parent_id")
        .in("id", orphanParentIds);
      structuralParents = parents ?? [];
    }

    const allParents = [
      ...archivedParents.map((c) => ({ ...c, isArchived: true })),
      ...structuralParents.map((c) => ({ ...c, isArchived: false })),
    ];
    const allChildren = archivedChildren.map((c) => ({ ...c, isArchived: true }));

    const defaultCategories = buildStructuredCategoriesWithArchived(allParents, allChildren);

    return jsonCachedResponse({
      data: {
        defaultCategories,
        userCategories: [],
      },
    }, 200, 180, 900);
  }

  const { data: archivedRows } = await supabase
    .from("user_archived_categories")
    .select("category_id")
    .eq("user_id", user.id);
  const archivedIds = new Set((archivedRows ?? []).map((r) => r.category_id));

  const [userCatsResult, systemCatsResult] = await Promise.all([
    supabase
      .from("categories")
      .select("*")
      .eq("user_id", user.id)
      .order("name", { ascending: true }),
    supabase
      .from("categories")
      .select("*")
      .is("user_id", null)
      .order("name", { ascending: true }),
  ]);

  if (userCatsResult.error) return jsonError(userCatsResult.error.message, 500);
  if (systemCatsResult.error) return jsonError(systemCatsResult.error.message, 500);

  const userCats = userCatsResult.data ?? [];
  const systemCats = (systemCatsResult.data ?? []).filter((c) => !archivedIds.has(c.id));

  const systemIds = new Set(systemCats.map((c) => c.id));
  const userParents = userCats.filter((c) => !c.parent_id);
  const userChildrenUserParent = userCats.filter(
    (c) => c.parent_id && !systemIds.has(c.parent_id)
  );
  const userChildrenSystemParent = userCats.filter(
    (c) => c.parent_id && systemIds.has(c.parent_id)
  );

  const structuredUser = userParents.map((parent) => ({
    ...parent,
    isDefault: false,
    subcategories: userChildrenUserParent
      .filter((c) => c.parent_id === parent.id)
      .map((c) => ({ ...c, isDefault: false })),
  }));

  const systemParents = systemCats.filter((c) => !c.parent_id);
  const systemChildren = systemCats.filter((c) => c.parent_id);

  const structuredSystem = systemParents.map((parent) => {
    const sysSubs = systemChildren
      .filter((c) => c.parent_id === parent.id)
      .map((c) => ({ ...c, isDefault: true }));
    const usrSubs = userChildrenSystemParent
      .filter((c) => c.parent_id === parent.id)
      .map((c) => ({ ...c, isDefault: false }));
    return {
      ...parent,
      isDefault: true,
      subcategories: [...sysSubs, ...usrSubs],
    };
  });

  return jsonCachedResponse({
    data: {
      defaultCategories: structuredSystem,
      userCategories: structuredUser,
    },
  }, 200, 180, 900);
}

function buildStructuredCategories(
  parents: { id: string; name: string; name_en?: string; emoji?: string; parent_id?: string | null }[],
  children: { id: string; name: string; name_en?: string; emoji?: string; parent_id?: string | null }[]
) {
  const tops = parents.filter((c) => !c.parent_id);
  const subs = children.filter((c) => c.parent_id);
  return tops.map((parent) => ({
    ...parent,
    isDefault: true,
    subcategories: subs
      .filter((c) => c.parent_id === parent.id)
      .map((c) => ({ ...c, isDefault: true })),
  }));
}

type CatWithArchived = {
  id: string;
  name: string;
  name_en?: string;
  emoji?: string;
  parent_id?: string | null;
  isArchived?: boolean;
  [k: string]: unknown;
};

function buildStructuredCategoriesWithArchived(
  parents: CatWithArchived[],
  children: CatWithArchived[]
) {
  const tops = parents.filter((c) => !c.parent_id);
  const subs = children.filter((c) => c.parent_id);
  return tops.map((parent) => ({
    ...parent,
    isDefault: true,
    subcategories: subs
      .filter((c) => c.parent_id === parent.id)
      .map((c) => ({ ...c, isDefault: true })),
  }));
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
  const emoji = body.emoji || null;
  const parent_id =
    body.parent_id === "null" || body.parent_id === "" ? null : body.parent_id;

  if (!name) {
    return jsonError("missing_fields");
  }

  if (parent_id) {
    const { data: parent } = await supabase
      .from("categories")
      .select("id, user_id")
      .eq("id", parent_id)
      .single();
    if (!parent) return jsonError("parent_not_found");
    if (parent.user_id === null) {
      const { data: archived } = await supabase
        .from("user_archived_categories")
        .select("category_id")
        .eq("user_id", user.id)
        .eq("category_id", parent_id)
        .maybeSingle();
      if (archived) return jsonError("parent_archived");
    }
  }

  const { data: insertedData, error } = await supabase
    .from("categories")
    .insert({ user_id: user.id, name, parent_id, emoji })
    .select()
    .single();

  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonResponse({ data: insertedData }, 201);
}
