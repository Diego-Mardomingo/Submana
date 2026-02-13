
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

    if (!id) {
        return redirect("/categories?error=missing_id");
    }

    const { error } = await supabase
        .from("categories")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

    if (error) {
        return redirect(`/categories?error=${error.message}`);
    }

    return redirect("/categories?success=category_deleted");
};
