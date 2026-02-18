
import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";

export const GET: APIRoute = async ({ cookies }) => {
    const accessToken = cookies.get("sb-access-token");
    const refreshToken = cookies.get("sb-refresh-token");

    if (!accessToken || !refreshToken) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken.value);

    if (authError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const { data: categories, error } = await supabase
        .from("categories")
        .select("*")
        .eq("user_id", user.id)
        .order("name", { ascending: true });

    if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    // Organize into parent-child structure
    const parents = categories.filter(c => !c.parent_id);
    const children = categories.filter(c => c.parent_id);

    const structuredCategories = parents.map(parent => ({
        ...parent,
        subcategories: children.filter(child => child.parent_id === parent.id)
    }));

    return new Response(JSON.stringify({ categories: structuredCategories }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
};
