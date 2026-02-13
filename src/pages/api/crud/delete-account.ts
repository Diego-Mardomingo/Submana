
import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
    const accessToken = cookies.get("sb-access-token");
    const refreshToken = cookies.get("sb-refresh-token");

    if (!accessToken || !refreshToken) {
        return redirect("/login");
    }

    let { data: session, error: authError } = await supabase.auth.setSession({
        access_token: accessToken.value,
        refresh_token: refreshToken.value,
    });

    if (authError || !session.user) {
        return redirect("/login");
    }

    const user = session.user;

    const formData = await request.formData();
    const id = formData.get("id")?.toString();

    if (!id) {
        return redirect("/accounts?error=missing_id");
    }

    const { error } = await supabase
        .from("accounts")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

    if (error) {
        return redirect(`/accounts?error=${error.message}`);
    }

    return redirect("/accounts?success=account_deleted");
};
