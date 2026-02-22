
import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
    const accessToken = cookies.get("sb-access-token");
    const refreshToken = cookies.get("sb-refresh-token");

    console.log("Cookies present:", !!accessToken, !!refreshToken);

    if (!accessToken || !refreshToken) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const { data, error: authError } = await supabase.auth.setSession({
        access_token: accessToken.value,
        refresh_token: refreshToken.value,
    });

    if (authError || !data.user || !data.session) {
        console.error("Auth error in set-default:", authError);
        return new Response(JSON.stringify({ error: "Unauthorized", details: authError?.message }), { status: 401 });
    }

    // Sync refreshed session back to cookies
    const { access_token, refresh_token } = data.session;
    cookies.set("sb-access-token", access_token, { path: "/", maxAge: 60 * 60 * 24 * 30 });
    cookies.set("sb-refresh-token", refresh_token, { path: "/", maxAge: 60 * 60 * 24 * 30 });

    const user = data.user;

    const formData = await request.formData();
    const accountId = formData.get("id")?.toString();

    if (!accountId) {
        return new Response(JSON.stringify({ error: "Missing account ID" }), { status: 400 });
    }

    try {
        // 1. Reset all accounts for this user to is_default = false
        const { error: resetError } = await supabase
            .from("accounts")
            .update({ is_default: false })
            .eq("user_id", user.id);

        if (resetError) throw resetError;

        // 2. Set the selected account to is_default = true
        const { error: setError } = await supabase
            .from("accounts")
            .update({ is_default: true })
            .eq("id", accountId)
            .eq("user_id", user.id);

        if (setError) throw setError;

    } catch (err) {
        console.error("Error setting default account:", err);
        return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
};
