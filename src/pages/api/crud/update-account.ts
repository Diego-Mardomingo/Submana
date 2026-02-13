
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
    const name = body.name;
    const balance = parseFloat(body.balance || "0");
    const icon = body.icon;
    const color = body.color;

    if (!id || !name) {
        if (isJson) return jsonError("missing_fields");
        const referer = request.headers.get("referer") || "/accounts";
        return redirect(`${referer}?error=missing_fields`);
    }

    const { data: updatedData, error } = await supabase
        .from("accounts")
        .update({ name, balance, icon, color })
        .eq("id", id)
        .eq("user_id", user.id)
        .select()
        .single();

    if (error) {
        if (isJson) return jsonError(error.message, 500);
        const referer = request.headers.get("referer") || "/accounts";
        return redirect(`${referer}?error=${error.message}`);
    }

    if (isJson) return jsonResponse({ success: true, account: updatedData });
    return redirect("/accounts?success=account_updated");
};
