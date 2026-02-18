
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
    const name = body.name;
    const balance = body.balance ? parseFloat(body.balance) : 0;
    const icon = body.icon;
    const color = body.color;

    if (!name || isNaN(balance)) {
        if (isJson) return jsonError("missing_fields");
        return redirect("/accounts?error=missing_fields");
    }

    try {
        const { data: insertedData, error } = await supabase
            .from("accounts")
            .insert({
                user_id: user.id,
                name,
                balance,
                icon,
                color,
            })
            .select()
            .single();

        if (error) {
            console.error("Supabase error creating account:", error);
            if (isJson) return jsonError(error.message, 500);
            return redirect(
                `/accounts?error=${encodeURIComponent(error.message)}`
            );
        }

        if (isJson)
            return jsonResponse({ success: true, account: insertedData }, 201);
        return redirect("/accounts?success=account_created");
    } catch (err) {
        console.error("Unexpected error creating account:", err);
        if (isJson) return jsonError("unexpected_error", 500);
        return redirect("/accounts?error=unexpected_error");
    }
};
