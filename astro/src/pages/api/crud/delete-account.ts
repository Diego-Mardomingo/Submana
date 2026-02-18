
import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";
import {
    parseRequestBody,
    jsonResponse,
    jsonError,
} from "../../../lib/apiHelpers";

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

    const { body, isJson } = await parseRequestBody(request);
    const id = body.id;

    if (!id) {
        if (isJson) return jsonError("missing_id");
        return redirect("/accounts?error=missing_id");
    }

    const { error } = await supabase
        .from("accounts")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

    if (error) {
        if (isJson) return jsonError(error.message, 500);
        return redirect(`/accounts?error=${error.message}`);
    }

    if (isJson) return jsonResponse({ success: true });
    return redirect("/accounts?success=account_deleted");
};
