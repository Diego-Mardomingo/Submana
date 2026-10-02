import { NextRequest } from "next/server";
import { getAuthedClient, jsonCachedResponse, jsonError, jsonResponse, jsonServerError, parseRequestBody, unauthorized } from "@/lib/apiHelpers";

type Category = { id: string; parent_id: string | null; exclude_from_metrics?: boolean };

/** Nests `subs` under each root of `parents`, tagging system (isDefault) vs user categories. */
function withSubcategories<T extends Category>(parents: T[], subs: T[], isDefault: (c: T) => boolean) {
  return parents
    .filter((p) => !p.parent_id)
    .map((p) => ({
      ...p,
      isDefault: isDefault(p),
      subcategories: subs.filter((c) => c.parent_id === p.id).map((c) => ({ ...c, isDefault: isDefault(c) })),
    }));
}

export async function GET(request: NextRequest) {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const { data: archivedRows } = await supabase.from("user_archived_categories").select("category_id").eq("user_id", user.id);
  const archivedIds = new Set((archivedRows ?? []).map((r) => r.category_id as string));

  if (request.nextUrl.searchParams.get("archived") === "true") {
    const { data: archived, error } = await supabase
      .from("categories")
      .select("*")
      .is("user_id", null)
      .in("id", [...archivedIds])
      .order("name", { ascending: true });
    if (error) return jsonServerError("crud/categories", error);

    // Archived subcategories whose parent is still active are shown under that (non-archived) parent.
    const children = archived.filter((c) => c.parent_id);
    const orphanParentIds = [...new Set(children.map((c) => c.parent_id as string))].filter((id) => !archivedIds.has(id));
    const { data: structural } = orphanParentIds.length
      ? await supabase.from("categories").select("id, name, name_en, emoji, parent_id").in("id", orphanParentIds)
      : { data: [] };
    const parents = [
      ...archived.map((c) => ({ ...c, isArchived: true })),
      ...(structural ?? []).map((c) => ({ ...c, isArchived: false })),
    ];
    const defaultCategories = withSubcategories(parents, children.map((c) => ({ ...c, isArchived: true })), () => true);
    return jsonCachedResponse({ data: { defaultCategories, userCategories: [] } });
  }

  const [userResult, systemResult] = await Promise.all([
    supabase.from("categories").select("*").eq("user_id", user.id).order("name", { ascending: true }),
    supabase.from("categories").select("*").is("user_id", null).order("name", { ascending: true }),
  ]);
  if (userResult.error) return jsonServerError("crud/categories", userResult.error);
  if (systemResult.error) return jsonServerError("crud/categories", systemResult.error);

  const userCats: Category[] = userResult.data;
  const systemCats: Category[] = systemResult.data.filter((c) => !archivedIds.has(c.id));
  const systemIds = new Set(systemCats.map((c) => c.id));
  const isSystem = (c: Category) => systemIds.has(c.id);

  const userCategories = withSubcategories(userCats, userCats.filter((c) => !systemIds.has(c.parent_id ?? "")), isSystem);
  const defaultCategories = withSubcategories(systemCats, [...systemCats, ...userCats], isSystem)
    // Exclude-from-metrics categories go last (stable sort keeps alphabetical order otherwise).
    .sort((a, b) => Number(!!a.exclude_from_metrics) - Number(!!b.exclude_from_metrics));
  return jsonCachedResponse({ data: { defaultCategories, userCategories } });
}

export async function POST(request: NextRequest) {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const body = await parseRequestBody(request);
  const parent_id = body.parent_id && body.parent_id !== "null" ? body.parent_id : null;
  if (!body.name) return jsonError("missing_fields");

  if (parent_id) {
    const { data: parent } = await supabase.from("categories").select("user_id").eq("id", parent_id).single();
    if (!parent || (parent.user_id !== null && parent.user_id !== user.id)) return jsonError("parent_not_found");
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

  const { data, error } = await supabase
    .from("categories")
    .insert({ user_id: user.id, name: body.name, parent_id, emoji: body.emoji || null })
    .select()
    .single();
  if (error) return jsonServerError("crud/categories", error);
  return jsonResponse({ data }, 201);
}
