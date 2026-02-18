
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
    const id = formData.get("id")?.toString();
    const name = formData.get("name")?.toString();

    if (!id || !name) {
        const referer = request.headers.get("referer") || "/categories";
        return redirect(`${referer}?error=missing_fields`);
    }

    const { error } = await supabase
        .from("categories")
        .update({ name })
        .eq("id", id)
        .eq("user_id", user.id);

    if (error) {
        const referer = request.headers.get("referer") || "/categories";
        return redirect(`${referer}?error=${encodeURIComponent(error.message)}`);
    }

    // Redirect back to categories page
    return redirect("/categories?success=category_updated");
};
