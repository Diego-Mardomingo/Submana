
import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
    const accessToken = cookies.get("sb-access-token");
    const refreshToken = cookies.get("sb-refresh-token");

    if (!accessToken || !refreshToken) {
        return redirect("/login");
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken.value);

    if (authError || !user) {
        return redirect("/login");
    }

    const formData = await request.formData();
    const name = formData.get("name")?.toString();
    const parent_id = formData.get("parent_id")?.toString() || null;

    if (!name) {
        return redirect("/categories?error=missing_fields");
    }

    const { error } = await supabase.from("categories").insert({
        user_id: user.id,
        name,
        parent_id: parent_id === "null" || parent_id === "" ? null : parent_id,
    });

    if (error) {
        return redirect(`/categories?error=${encodeURIComponent(error.message)}`);
    }

    return redirect("/categories?success=category_created");
};
